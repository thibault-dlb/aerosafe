from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Select
from sqlalchemy.ext.asyncio import AsyncSession

from core.data_mode import DataMode
from core.logger import get_logger
from core.repository import Repository
from models import Aircraft, Alert, Rule
from services.rules.base import AircraftSnapshot, BusinessRule
from services.rules.observations import SnapshotReader
from services.rules.registry import RuleRegistry

logger = get_logger()


@dataclass(frozen=True)
class EvaluationReport:
    """What one evaluation did, for the logs and the tests."""

    aircraft: int = 0
    rules: int = 0
    created: int = 0
    closed: int = 0


class RulesEngine:
    """Evaluates the active rules. The scheduler calls it right after each collection.

    An aircraft raises a rule once per episode: while an alert of the same rule is still open
    for it, no new alert is created. The episode ends at the first evaluation where the value
    is back under the threshold, or where the situation can no longer last: the aircraft is on
    the ground or no longer heard, or the rule is disabled. When an airborne aircraft lacks
    the data a rule needs (no position, no previous observation), its episode stays open.
    """

    def __init__(
        self,
        session: AsyncSession,
        registry: RuleRegistry | None = None,
        reader: SnapshotReader | None = None,
    ) -> None:
        self._session = session
        self._registry = registry or RuleRegistry()
        self._reader = reader or SnapshotReader(session)

    async def evaluate(self, now: datetime, mode: DataMode = DataMode.LIVE) -> EvaluationReport:
        """Evaluate the rules for the collection that ran at `now`.

        `now` is the collection time, not the time the engine runs, so a delay in the
        evaluation never makes the data look older than it is. The caller commits.

        `mode` picks the source: the live collection or the replayed history. A mode only sees
        the aircraft and the episodes of its own source, so a replay never ends a live episode,
        and the other way round. In a replay, `now` is an instant of the dataset.
        """
        rules = await self._active_rules(mode)
        snapshots = await self._reader.read(now, mode) if rules else []
        episodes = await self._open_episodes(mode)
        closed = self._end_finished_episodes(episodes, rules, snapshots, now)
        if not rules or not snapshots:
            if closed:
                await self._session.flush()
            reason = "no active rule" if not rules else "no aircraft to evaluate"
            logger.info(
                "Rule evaluation at {}: {}, {} episode(s) ended", now.isoformat(), reason, closed
            )
            return EvaluationReport(rules=len(rules), closed=closed)

        created = 0
        for model, rule in rules:
            threshold = float(model.threshold)
            for snapshot in snapshots:
                outcome = rule.check(snapshot, threshold, now)
                if outcome is None:
                    continue
                episode = episodes.get((snapshot.aircraft_id, model.id))
                if outcome.triggered and episode is None:
                    alert = Alert(
                        aircraft_id=snapshot.aircraft_id,
                        rule_id=model.id,
                        triggered_at=now,
                        observed_value=Decimal(str(outcome.observed_value)),
                        threshold=model.threshold,
                        message=outcome.message,
                        criticality_id=model.criticality_id,
                    )
                    self._session.add(alert)
                    episodes[(snapshot.aircraft_id, model.id)] = alert
                    created += 1
                    # NF-08: every trigger is logged with what explains it.
                    logger.info(
                        "Rule {} triggered for {}: {} {} > {} {}",
                        model.code,
                        snapshot.icao24,
                        outcome.observed_value,
                        rule.unit,
                        model.threshold,
                        rule.unit,
                    )
                elif not outcome.triggered and episode is not None:
                    self._end(episode, now)
                    del episodes[(snapshot.aircraft_id, model.id)]
                    closed += 1
                    logger.info("Rule {} back to normal for {}", model.code, snapshot.icao24)

        await self._session.flush()
        report = EvaluationReport(
            aircraft=len(snapshots), rules=len(rules), created=created, closed=closed
        )
        logger.info(
            "Rule evaluation at {}: {} aircraft, {} rules, {} alert(s), {} episode(s) ended",
            now.isoformat(),
            report.aircraft,
            report.rules,
            created,
            closed,
        )
        return report

    async def _active_rules(self, mode: DataMode) -> list[tuple[Rule, BusinessRule]]:
        """Active rules read from the database, so a threshold change applies at once (UC-05).

        A replay leaves out the rules that mean nothing on replayed traffic: their open
        episodes then end like those of a disabled rule.
        """
        statement = Repository(self._session, Rule).select().where(Rule.is_active.is_(True))
        rules = []
        for model in (await self._session.scalars(statement.order_by(Rule.code))).all():
            rule = self._registry.get(model.code)
            if rule is None:
                logger.warning("Rule {} has no implementation, skipped", model.code)
                continue
            if mode is DataMode.REPLAY and not rule.evaluated_in_replay:
                continue
            rules.append((model, rule))
        return rules

    @staticmethod
    def open_episodes_query(session: AsyncSession, mode: DataMode) -> Select:
        """The open episodes of the aircraft of one source."""
        return (
            Repository(session, Alert)
            .select()
            .join(Aircraft, Aircraft.id == Alert.aircraft_id)
            .where(Alert.episode_ended_at.is_(None), mode.matches(Aircraft.source_id))
        )

    async def _open_episodes(self, mode: DataMode) -> dict[tuple[int, int], Alert]:
        """Every open episode of the source. Episodes end when their aircraft stops being
        evaluated, so this set stays bounded by the aircraft in flight."""
        alerts = (await self._session.scalars(self.open_episodes_query(self._session, mode))).all()
        return {(alert.aircraft_id, alert.rule_id): alert for alert in alerts}

    @classmethod
    def _end_finished_episodes(
        cls,
        episodes: dict[tuple[int, int], Alert],
        rules: list[tuple[Rule, BusinessRule]],
        snapshots: list[AircraftSnapshot],
        now: datetime,
    ) -> int:
        """End the episodes that cannot last any more, and remove them from `episodes`.

        Otherwise an aircraft that landed, went silent or saw its rule disabled would keep an
        alert active for ever, and that alert would block the next one of the same rule.
        """
        active_rules = {model.id for model, _ in rules}
        airborne = {snapshot.aircraft_id for snapshot in snapshots if snapshot.airborne}
        finished = [key for key in episodes if key[0] not in airborne or key[1] not in active_rules]
        for key in finished:
            cls._end(episodes.pop(key), now)
            logger.info(
                "Episode of rule id {} ended for aircraft id {}: no longer evaluated",
                key[1],
                key[0],
            )
        return len(finished)

    @staticmethod
    def _end(episode: Alert, now: datetime) -> None:
        # Never before the trigger, which the table forbids, even when an evaluation is
        # replayed at an earlier time.
        episode.episode_ended_at = max(now, episode.triggered_at) if episode.triggered_at else now
