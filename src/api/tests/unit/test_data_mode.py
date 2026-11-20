import pytest
from sqlalchemy import literal_column
from sqlalchemy.dialects import postgresql

from core.data_mode import DataMode


@pytest.mark.parametrize(
    ("mode", "code", "label", "live"),
    [
        (DataMode.OPENSKY, "DIRECT", "OpenSky", True),
        (DataMode.ADSBFI, "ADSBFI", "adsb.fi", True),
        (DataMode.REPLAY, "REJEU", "replay", False),
    ],
)
def test_each_source_has_its_code_label_and_kind(
    mode: DataMode, code: str, label: str, live: bool
) -> None:
    assert (mode.code, mode.label, mode.is_live) == (code, label, live)


def test_the_api_values_are_the_names_of_the_sources() -> None:
    assert [mode.value for mode in DataMode] == ["opensky", "adsbfi", "replay"]
    assert DataMode("adsbfi") is DataMode.ADSBFI


def test_the_live_sources_are_opensky_then_adsbfi() -> None:
    assert DataMode.live_modes() == (DataMode.OPENSKY, DataMode.ADSBFI)


def test_a_source_condition_reads_its_key_from_its_code() -> None:
    condition = DataMode.ADSBFI.matches(literal_column('"ID_SOURCE_DONNEE"'))
    sql = str(
        condition.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
    )

    assert '"R_SOURCE_DONNEE"."CD_SOURCE_DONNEE" = \'ADSBFI\'' in sql
