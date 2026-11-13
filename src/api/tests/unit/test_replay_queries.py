"""The aircraft and alert queries of a replay: its own source, a short window, the instant."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.dialects import postgresql

from core.data_mode import REPLAY_WINDOW, DataMode
from services.aircraft import AircraftSearchCriteria, AircraftService, BoundingBox
from services.alerts.service import AlertFilters, AlertService

AT = datetime(2022, 8, 14, 15, 0, tzinfo=UTC)
PARIS = BoundingBox(south=48.1, west=1.4, north=49.3, east=3.6)


def compiled(statement):
    return statement.compile(dialect=postgresql.dialect())


def literal_sql(statement) -> str:
    return str(
        statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
    )


def search(**changes):
    criteria = AircraftSearchCriteria(mode=DataMode.REPLAY, at=AT, **changes)
    return AircraftService(AsyncMock()).search_query(criteria)


class TestAircraftSearchInAReplay:
    def test_only_the_aircraft_heard_in_the_minute_before_the_instant_are_listed(self) -> None:
        query = compiled(search())
        sql = str(query)

        assert "DISTINCT ON" in sql
        assert '"DT_DERNIER_CONTACT" >' in sql and '"DT_DERNIER_CONTACT" <=' in sql
        assert {AT, AT - REPLAY_WINDOW} <= set(query.params.values())
        # An inner join: an aircraft that is not flying at that instant is not in the list.
        assert " JOIN (SELECT DISTINCT ON" in sql
        assert "LATERAL" not in sql

    def test_the_replay_reads_the_aircraft_of_its_own_source(self) -> None:
        assert "'REJEU'" in literal_sql(search())
        live = literal_sql(AircraftService(AsyncMock()).search_query(AircraftSearchCriteria()))
        assert "'DIRECT'" in live and "'REJEU'" not in live

    def test_the_area_filters_on_the_position_at_the_instant(self) -> None:
        sql = str(compiled(search(area=PARIS)))

        assert 'ST_Intersects(latest."GEO_POSITION", ST_MakeEnvelope(' in sql

    def test_a_replay_without_an_instant_is_refused(self) -> None:
        criteria = AircraftSearchCriteria(mode=DataMode.REPLAY)

        with pytest.raises(ValueError, match="instant"):
            AircraftService(AsyncMock()).search_query(criteria)

    def test_the_filters_of_the_search_still_apply(self) -> None:
        query = compiled(search(icao24="3C64", registration="aib"))

        assert "3c64%" in query.params.values()
        assert "%aib%" in query.params.values()


class TestAircraftRecordInAReplay:
    def test_the_position_is_the_latest_one_up_to_the_instant(self) -> None:
        statement, _ = AircraftService(AsyncMock()).summary_query(AT)

        query = compiled(statement)
        assert '"DT_DERNIER_CONTACT" <=' in str(query)
        assert AT in query.params.values()
        assert "LATERAL" in str(query)

    def test_without_an_instant_the_latest_observation_has_no_bound(self) -> None:
        statement, _ = AircraftService(AsyncMock()).summary_query()

        assert '"DT_DERNIER_CONTACT" <=' not in str(compiled(statement))


class TestAlertsInAReplay:
    def where(self, **changes) -> str:
        service = AlertService(AsyncMock())
        filtered = service.filter(service.base_query(), AlertFilters(**changes))
        return literal_sql(filtered)

    def test_the_alerts_are_those_of_the_aircraft_of_the_source(self) -> None:
        assert "'REJEU'" in self.where(mode=DataMode.REPLAY, at=AT)
        live = self.where()
        assert "'DIRECT'" in live and "'REJEU'" not in live

    def test_an_alert_after_the_simulated_instant_has_not_happened_yet(self) -> None:
        sql = self.where(mode=DataMode.REPLAY, at=AT)

        assert '"ALERTE"."DT_DECLENCHEMENT" <= \'2022-08-14 15:00:00+00:00\'' in sql

    def test_live_has_no_upper_bound_of_its_own(self) -> None:
        assert '"DT_DECLENCHEMENT" <=' not in self.where()

    def test_the_period_of_the_user_still_applies(self) -> None:
        sql = self.where(
            mode=DataMode.REPLAY,
            at=AT,
            start=AT - timedelta(hours=1),
            end=AT - timedelta(minutes=5),
        )

        assert '"ALERTE"."DT_DECLENCHEMENT" >=' in sql
        assert sql.count('"ALERTE"."DT_DECLENCHEMENT" <=') == 2

    async def test_the_statistics_count_the_alerts_of_the_source_only(self) -> None:
        session = AsyncMock()
        result = AsyncMock()
        result.all = lambda: [("R3", 2)]
        session.execute.return_value = result

        statistics = await AlertService(session).statistics(
            AT - timedelta(hours=24), AT, DataMode.REPLAY
        )

        assert statistics.total == 2 and statistics.per_rule == {"R3": 2}
        sql = literal_sql(session.execute.await_args.args[0])
        assert 'JOIN "AERONEF"' in sql and "'REJEU'" in sql
