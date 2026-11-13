from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from models import Aircraft
from services.aircraft import AircraftSearchCriteria, AircraftService, BoundingBox
from services.aircraft.service import escape_like

PARIS = BoundingBox(south=48.1, west=1.4, north=49.3, east=3.6)
SEEN_AT = datetime(2026, 11, 9, 10, 0, tzinfo=UTC)


def compiled(criteria: AircraftSearchCriteria):
    statement = AircraftService(AsyncMock()).search_query(criteria)
    return statement.compile(dialect=postgresql.dialect())


class FakeRow(SimpleNamespace):
    """Mimics a SQLAlchemy row: the model at index 0, the extra columns as attributes."""

    def __init__(self, aircraft: Aircraft, columns: dict) -> None:
        super().__init__(**columns)
        self._aircraft = aircraft

    def __getitem__(self, index: int) -> Aircraft:
        assert index == 0
        return self._aircraft


def row(**values) -> FakeRow:
    aircraft = Aircraft(
        icao24="3c6444", registration="D-AIBD", public_id="01JC0000000000000000000000"
    )
    columns = {
        "model_label": "Airbus A319",
        "airline_label": "Lufthansa",
        "last_contact_at": SEEN_AT,
        "latitude": 48.85,
        "longitude": 2.35,
        "altitude": Decimal("10972.80"),
    }
    columns.update(values)
    return FakeRow(aircraft, columns)


def session_returning(rows: list) -> AsyncMock:
    result = MagicMock()
    result.all.return_value = rows
    result.first.return_value = rows[0] if rows else None
    session = AsyncMock()
    session.execute.return_value = result
    return session


def test_like_wildcards_in_user_input_match_themselves() -> None:
    assert escape_like("F-G%_\\") == "F-G\\%\\_\\\\"


@pytest.mark.parametrize(
    "box",
    [
        {"south": 50, "west": 0, "north": 40, "east": 1},
        {"south": -91, "west": 0, "north": 0, "east": 1},
        {"south": 0, "west": 10, "north": 1, "east": 5},
        {"south": 0, "west": 0, "north": 1, "east": 181},
    ],
)
def test_an_invalid_area_is_refused(box: dict) -> None:
    with pytest.raises(ValueError):
        BoundingBox(**box)


def test_a_search_without_criteria_lists_active_aircraft_by_address() -> None:
    sql = str(compiled(AircraftSearchCriteria()))

    assert "deleted_at IS NULL" in sql
    assert 'ORDER BY "AERONEF"."CD_ICAO24"' in sql
    assert "LIMIT" in sql
    assert "DISTINCT ON" in sql


def test_the_address_is_a_lowercase_prefix() -> None:
    query = compiled(AircraftSearchCriteria(icao24="3C64"))

    assert '"AERONEF"."CD_ICAO24" LIKE' in str(query)
    assert "3c64%" in query.params.values()


def test_the_registration_matches_anywhere_ignoring_case() -> None:
    query = compiled(AircraftSearchCriteria(registration="aib"))

    assert '"AERONEF"."LB_IMMATRICULATION" ILIKE' in str(query)
    assert "%aib%" in query.params.values()


def test_the_airline_matches_its_name_or_its_code() -> None:
    sql = str(compiled(AircraftSearchCriteria(airline="Air France")))

    assert '"R_COMPAGNIE"."LB_COMPAGNIE" ILIKE' in sql
    assert '"R_COMPAGNIE"."CD_COMPAGNIE" ILIKE' in sql


def test_the_area_filters_on_the_latest_position() -> None:
    query = compiled(AircraftSearchCriteria(area=PARIS))
    sql = str(query)

    assert 'ST_Intersects(latest."GEO_POSITION", ST_MakeEnvelope(' in sql
    assert {1.4, 48.1, 3.6, 49.3, 4326} <= set(query.params.values())


async def test_search_maps_each_row_to_a_summary() -> None:
    service = AircraftService(session_returning([row()]))

    [summary] = await service.search(AircraftSearchCriteria())

    assert summary.id == "01JC0000000000000000000000"
    assert summary.icao24 == "3c6444"
    assert summary.model == "Airbus A319"
    assert summary.airline == "Lufthansa"
    assert summary.last_contact_at == SEEN_AT
    assert (summary.latitude, summary.longitude) == (48.85, 2.35)
    assert summary.altitude == 10972.8


async def test_an_aircraft_never_observed_has_no_position() -> None:
    service = AircraftService(
        session_returning([row(last_contact_at=None, latitude=None, longitude=None, altitude=None)])
    )

    [summary] = await service.search(AircraftSearchCriteria())

    assert summary.latitude is None
    assert summary.altitude is None
    assert summary.last_contact_at is None


async def test_get_looks_up_the_public_identifier() -> None:
    session = session_returning([row()])

    summary = await AircraftService(session).get("01JC0000000000000000000000")

    assert summary is not None
    statement = session.execute.await_args.args[0]
    assert '"AERONEF"."CD_ULID" =' in str(statement.compile(dialect=postgresql.dialect()))


async def test_get_returns_none_for_an_unknown_aircraft() -> None:
    assert await AircraftService(session_returning([])).get("unknown") is None
