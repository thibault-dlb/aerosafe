from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from core.data_mode import DataMode
from schemas.alert import AlertOut
from schemas.dashboard import (
    CollectionArea,
    CollectionRunSummary,
    CollectionSummary,
    DashboardCounters,
    DashboardOut,
    DashboardStatisticsOut,
    StatisticsPeriod,
    StatisticsSlice,
)
from services.alerts.service import AlertFilters, AlertService, AlertStatus
from services.collection.profiles import CollectionProfile
from services.collection.run_state import CollectionStateStore

ACTIVE_ALERTS_SHOWN = 5
RECENT_RUNS_SHOWN = 12
# The aircraft with an active alert the map colours: far more than the list shows.
ALERTED_AIRCRAFT_SHOWN = 500
CRITICALITY_RANK = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}


@dataclass(frozen=True)
class PeriodLayout:
    """How a period is cut: `count` slices of one `unit` (`hour` or `day`)."""

    unit: str
    count: int

    @property
    def step(self) -> timedelta:
        return timedelta(hours=1) if self.unit == "hour" else timedelta(days=1)

    def floor(self, instant: datetime) -> datetime:
        instant = instant.astimezone(UTC)
        if self.unit == "hour":
            return instant.replace(minute=0, second=0, microsecond=0)
        return instant.replace(hour=0, minute=0, second=0, microsecond=0)


LAYOUTS = {
    StatisticsPeriod.DAY: PeriodLayout("hour", 24),
    StatisticsPeriod.WEEK: PeriodLayout("day", 7),
    StatisticsPeriod.MONTH: PeriodLayout("day", 30),
}


class DashboardService:
    """What the dashboard shows, built from the alerts and the state of the collection.

    It reads through `AlertService` and `CollectionStateStore`, never the tables themselves
    (contracts of docs/team-split.md). Every account reads it; it changes nothing.
    """

    def __init__(self, alerts: AlertService, collection: CollectionStateStore) -> None:
        self._alerts = alerts
        self._collection = collection

    async def overview(
        self,
        mode: DataMode,
        at: datetime | None,
        *,
        collection_enabled: bool,
        collection_running: bool,
        collection_source: DataMode = DataMode.OPENSKY,
        collection_profile: CollectionProfile | None = None,
    ) -> DashboardOut:
        """Figures, latest active alerts and collection state. `at` is the simulated instant."""
        now = at or datetime.now(UTC)
        latest = await self._alerts.search(
            AlertFilters(status=AlertStatus.ACTIVE, limit=ACTIVE_ALERTS_SHOWN, mode=mode, at=at)
        )
        unprocessed = await self._alerts.search(
            AlertFilters(status=AlertStatus.UNPROCESSED, limit=1, mode=mode, at=at)
        )
        active = await self._alerts.search(
            AlertFilters(status=AlertStatus.ACTIVE, limit=ALERTED_AIRCRAFT_SHOWN, mode=mode, at=at)
        )
        day = await self._alerts.statistics(now - timedelta(hours=24), now, mode)
        return DashboardOut(
            counters=DashboardCounters(
                active_alerts=latest.total,
                unprocessed_alerts=unprocessed.total,
                alerts_24h=day.total,
            ),
            active_alerts=latest.items,
            alerted_aircraft=self.most_critical_per_aircraft(active.items),
            collection=await self.collection(
                collection_enabled, collection_running, collection_source, collection_profile
            ),
        )

    @staticmethod
    def most_critical_per_aircraft(alerts: list[AlertOut]) -> list[AlertOut]:
        """One alert for each aircraft: the most critical, the latest among equals."""
        best: dict[str, AlertOut] = {}
        for alert in alerts:  # newest first
            held = best.get(alert.aircraft_id)
            rank = CRITICALITY_RANK.get(alert.criticality or "", 0)
            if held is None or rank > CRITICALITY_RANK.get(held.criticality or "", 0):
                best[alert.aircraft_id] = alert
        return list(best.values())

    @staticmethod
    def empty(collection: CollectionSummary) -> DashboardOut:
        """A replay that never started: nothing to count, but the collection state is real."""
        return DashboardOut(
            counters=DashboardCounters(active_alerts=0, unprocessed_alerts=0, alerts_24h=0),
            active_alerts=[],
            collection=collection,
        )

    async def collection(
        self,
        enabled: bool,
        running: bool,
        source: DataMode = DataMode.OPENSKY,
        profile: CollectionProfile | None = None,
    ) -> CollectionSummary:
        """The state of the collection of one live source; `profile` gives its period and its
        area, which the map follows."""
        pause = await self._collection.pause_state(source)
        runs = await self._collection.runs(limit=RECENT_RUNS_SHOWN, source=source)
        last_success = await self._collection.last_success(source)
        bounds = profile.bounding_box if profile else None
        return CollectionSummary(
            source=source.value,
            period_seconds=profile.period_seconds if profile else None,
            area=None
            if bounds is None
            else CollectionArea(
                south=bounds.lat_min, west=bounds.lon_min, north=bounds.lat_max, east=bounds.lon_max
            ),
            enabled=enabled,
            paused=pause.paused,
            running=running,
            last_success_at=last_success.ended_at if last_success else None,
            remaining_credits=last_success.remaining_credits if last_success else None,
            recent_runs=[
                CollectionRunSummary(started_at=run.started_at, status=run.status) for run in runs
            ],
        )

    async def empty_statistics(self, period: StatisticsPeriod) -> DashboardStatisticsOut:
        """A replay that never started: every slice is empty."""
        return self._slices(period, datetime.now(UTC), {})

    async def statistics(
        self, period: StatisticsPeriod, mode: DataMode, at: datetime | None
    ) -> DashboardStatisticsOut:
        """Alerts per slice of time and per rule, the empty slices included."""
        layout = LAYOUTS[period]
        end = at or datetime.now(UTC)
        first = layout.floor(end) - layout.step * (layout.count - 1)
        found = {
            counted.start: counted.per_rule
            for counted in await self._alerts.statistics_by_slice(first, end, layout.unit, mode)
        }
        return self._slices(period, end, found)

    @staticmethod
    def _slices(
        period: StatisticsPeriod, end: datetime, found: dict[datetime, dict[str, int]]
    ) -> DashboardStatisticsOut:
        layout = LAYOUTS[period]
        first = layout.floor(end) - layout.step * (layout.count - 1)
        slices = []
        for index in range(layout.count):
            begin = first + layout.step * index
            per_rule = found.get(begin, {})
            slices.append(
                StatisticsSlice(start=begin, total=sum(per_rule.values()), per_rule=per_rule)
            )
        return DashboardStatisticsOut(
            period=period,
            unit=layout.unit,
            start=first,
            end=end,
            total=sum(item.total for item in slices),
            slices=slices,
        )
