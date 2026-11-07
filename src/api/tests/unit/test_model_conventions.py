"""Checks the database conventions (docs/database-conventions.md) on every model."""

from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import BigInteger, Enum, Table

import models  # noqa: F401
from core.models import Base, new_ulid

TABLES = list(Base.metadata.tables.values())
API_ROOT = Path(__file__).resolve().parents[2]


def table_ids() -> list[str]:
    return [table.name for table in TABLES]


def test_every_table_of_the_data_model_is_declared() -> None:
    assert len(TABLES) == 15


@pytest.mark.parametrize("table", TABLES, ids=table_ids())
def test_table_and_columns_have_a_comment(table: Table) -> None:
    assert table.comment
    assert [column.name for column in table.columns if not column.comment] == []


@pytest.mark.parametrize("table", TABLES, ids=table_ids())
def test_primary_key_is_a_bigint_identity(table: Table) -> None:
    [key] = table.primary_key.columns

    assert isinstance(key.type, BigInteger)
    assert key.identity is not None and key.identity.always


@pytest.mark.parametrize("table", TABLES, ids=table_ids())
def test_every_foreign_key_is_indexed(table: Table) -> None:
    leading_columns = {index.columns[0].name for index in table.indexes if len(index.columns)}
    for constraint in table.constraints:
        columns = getattr(constraint, "columns", None)
        if columns is not None and constraint.__class__.__name__ == "UniqueConstraint":
            leading_columns.add(next(iter(columns)).name)

    missing = [
        column.name
        for column in table.columns
        if column.foreign_keys and column.name not in leading_columns
    ]

    assert missing == []


@pytest.mark.parametrize("table", TABLES, ids=table_ids())
def test_no_enum_type(table: Table) -> None:
    assert [c.name for c in table.columns if isinstance(c.type, Enum)] == []


def test_migrations_form_a_single_chain() -> None:
    config = Config(str(API_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(API_ROOT / "database" / "migrations"))

    assert len(ScriptDirectory.from_config(config).get_heads()) == 1


def test_new_ulid_has_the_public_identifier_format() -> None:
    assert len(new_ulid()) == 26
