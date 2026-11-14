from datetime import UTC, datetime, timedelta

import pytest

from core.data_mode import DataMode
from schemas.alert import AlertOut, AlertPage
from schemas.dashboard import StatisticsPeriod
from services.alerts.service import (
    AlertBucketCount,
    AlertFilters,
    AlertStatistics,
    AlertStatus,
)
from services.collection.run_state import (
    CollectionRunResult,
    InMemoryCollectionStateStore,
    RunStatus,
)
from services.dashboard.service import DashboardService

NOW = datetime(2026, 11, 14, 10, 30, 15, tzinfo=UTC)
ALERT = AlertOut(
    id="01JC0000000000000000000A01",
    aircraft_id="01JC0000000000000000000001",
    icao24="3c6444",
    rule_code="R1",
    rule_description="Délai trop long depuis le dernier contact",
    triggered_at=NOW,
    unit="s",
    message="R1",
    criticality="HIGH",
)


class FakeAlerts:
    def __init__(self) -> None:
        self.searches: list[AlertFilters] = []
        self.slices: list[AlertBucketCount] = []
        self.sliced: tuple[datetime, datetime, str, DataMode] | None = None
        self.period: tuple[datetime, datetime, DataMode] | None = None

    async def search(self, filters: AlertFilters) -> AlertPage:
        self.searches.append(filters)
        if filters.status is AlertStatus.ACTIVE:
            return AlertPage(items=[ALERT], total=4)
        return AlertPage(items=[], total=9)

    async def statistics(
        self, start: datetime, end: datetime, mode: DataMode = DataMode.LIVE
    ) -> AlertStatistics:
        self.period = (start, end, mode)
        return AlertStatistics(total=17, per_rule={"R1": 17})

    async def statistics_by_slice(
        self, start: datetime, end: datetime, unit: str, mode: DataMode = DataMode.LIVE
    ) -> list[AlertBucketCount]:
        self.sliced = (start, end, unit, mode)
        return self.slices


def run(status: str, minute: int, credits: int | None = None) -> CollectionRunResult:
    started = NOW - timedelta(minutes=minute)
    return CollectionRunResult(
        started_at=started,
        ended_at=started + timedelta(seconds=5),
        status=status,
        profile="IDF",
        remaining_credits=credits,
    )


@pytest.fixture
def alerts() -> FakeAlerts:
    return FakeAlerts()


@pytest.fixture
def store() -> InMemoryCollectionStateStore:
    return InMemoryCollectionStateStore()


@pytest.fixture
def service(alerts: FakeAlerts, store: InMemoryCollectionStateStore) -> DashboardService:
    return DashboardService(alerts, store)  # type: ignore[arg-type]


class TestOverview:
    async def test_it_counts_the_alerts_and_lists_the_latest_active_ones(
        self, service: DashboardService, alerts: FakeAlerts
    ) -> None:
        out = await service.overview(
            DataMode.LIVE, NOW, collection_enabled=True, collection_running=False
        )

        assert out.counters.active_alerts == 4
        assert out.counters.unprocessed_alerts == 9
        assert out.counters.alerts_24h == 17
        assert out.active_alerts == [ALERT]
        assert alerts.period == (NOW - timedelta(hours=24), NOW, DataMode.LIVE)
        assert alerts.searches[0].mode is DataMode.LIVE
        assert alerts.searches[0].at == NOW

    async def test_it_gives_the_mode_and_instant_of_a_replay(
        self, service: DashboardService, alerts: FakeAlerts
    ) -> None:
        await service.overview(
            DataMode.REPLAY, NOW, collection_enabled=True, collection_running=False
        )

        assert {search.mode for search in alerts.searches} == {DataMode.REPLAY}
        assert alerts.period is not None
        assert alerts.period[2] is DataMode.REPLAY

    async def test_a_replay_that_never_started_shows_nothing_but_the_collection(
        self, service: DashboardService
    ) -> None:
        out = DashboardService.empty(await service.collection(True, False))

        assert out.counters.active_alerts == 0
        assert out.active_alerts == []
        assert out.collection.enabled is True


class TestCollection:
    async def test_without_a_run_nothing_is_known(self, service: DashboardService) -> None:
        summary = await service.collection(enabled=False, running=False)

        assert summary.enabled is False
        assert summary.last_success_at is None
        assert summary.remaining_credits is None
        assert summary.recent_runs == []

    async def test_it_gives_the_last_success_the_credits_and_the_recent_runs(
        self, service: DashboardService, store: InMemoryCollectionStateStore
    ) -> None:
        await store.record(run(RunStatus.SUCCESS, 20, credits=3900))
        await store.record(run(RunStatus.FAILED, 10))
        await store.set_paused(True, NOW, 1)

        summary = await service.collection(enabled=True, running=True)

        assert summary.paused is True
        assert summary.running is True
        assert summary.last_success_at == NOW - timedelta(minutes=20) + timedelta(seconds=5)
        assert summary.remaining_credits == 3900
        assert [item.status for item in summary.recent_runs] == [
            RunStatus.FAILED,
            RunStatus.SUCCESS,
        ]


class TestStatistics:
    async def test_the_day_is_cut_in_24_hours_ending_with_the_current_one(
        self, service: DashboardService, alerts: FakeAlerts
    ) -> None:
        alerts.slices = [
            AlertBucketCount(datetime(2026, 11, 14, 10, tzinfo=UTC), {"R1": 2, "R3": 1}),
            AlertBucketCount(datetime(2026, 11, 13, 11, tzinfo=UTC), {"R2": 4}),
        ]

        out = await service.statistics(StatisticsPeriod.DAY, DataMode.LIVE, NOW)

        assert out.unit == "hour"
        assert len(out.slices) == 24
        assert out.slices[0].start == datetime(2026, 11, 13, 11, tzinfo=UTC)
        assert out.slices[-1].start == datetime(2026, 11, 14, 10, tzinfo=UTC)
        assert out.slices[0].per_rule == {"R2": 4}
        assert out.slices[-1].total == 3
        assert out.slices[5].total == 0
        assert out.total == 7
        assert alerts.sliced == (out.start, NOW, "hour", DataMode.LIVE)

    @pytest.mark.parametrize(
        ("period", "count"), [(StatisticsPeriod.WEEK, 7), (StatisticsPeriod.MONTH, 30)]
    )
    async def test_the_longer_periods_are_cut_in_days(
        self, service: DashboardService, period: StatisticsPeriod, count: int
    ) -> None:
        out = await service.statistics(period, DataMode.REPLAY, NOW)

        assert out.unit == "day"
        assert len(out.slices) == count
        assert out.slices[-1].start == datetime(2026, 11, 14, tzinfo=UTC)
        assert out.slices[0].start == datetime(2026, 11, 14, tzinfo=UTC) - timedelta(days=count - 1)
        assert out.total == 0

    async def test_a_replay_that_never_started_has_only_empty_slices(
        self, service: DashboardService, alerts: FakeAlerts
    ) -> None:
        out = await service.empty_statistics(StatisticsPeriod.DAY)

        assert len(out.slices) == 24
        assert out.total == 0
        assert alerts.sliced is None
