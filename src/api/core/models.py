from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, Identity, MetaData, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column
from sqlalchemy.schema import Constraint, Table
from ulid import ULID

ULID_PATTERN = "^[0-9A-HJKMNP-TV-Z]{26}$"


def _lower_table_name(_constraint: Constraint, table: Table) -> str:
    return table.name.lower()


def _lower_column_names(constraint: Constraint, _table: Table) -> str:
    return "_".join(column.name.lower() for column in constraint.columns)


class Base(DeclarativeBase):
    """Declarative base of every database model.

    Table and column names are uppercase and quoted, so PostgreSQL keeps them as written.
    Constraint and index names are lowercase.
    """

    metadata = MetaData(
        naming_convention={
            "lower_table_name": _lower_table_name,
            "lower_column_names": _lower_column_names,
            "pk": "pk_%(lower_table_name)s",
            "fk": "fk_%(lower_table_name)s_%(lower_column_names)s",
            "uq": "uq_%(lower_table_name)s_%(lower_column_names)s",
            "ck": "ck_%(lower_table_name)s_%(constraint_name)s",
        }
    )


def primary_key(comment: str, name: str = "ID") -> Mapped[int]:
    """Build the BIGINT identity key shared by every table."""
    return mapped_column(
        name,
        BigInteger,
        Identity(always=True),
        primary_key=True,
        comment=comment,
        sort_order=-10,
    )


def new_ulid() -> str:
    """Generate a public identifier, the only identifier the API exposes."""
    return str(ULID())


class PublicIdMixin:
    """Adds the ULID exposed by the API. The BIGINT key stays internal."""

    @declared_attr
    def public_id(cls) -> Mapped[str]:
        return mapped_column(
            "CD_ULID",
            Text,
            nullable=False,
            unique=True,
            default=new_ulid,
            comment="Identifiant ULID exposé par l'API, généré par l'application.",
            sort_order=-9,
        )


class TimestampMixin:
    """Adds the standard columns of a business table."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Date de création de la ligne.",
        sort_order=100,
    )
    # A database trigger keeps this column current on every update.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Date de dernière modification de la ligne.",
        sort_order=101,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date de suppression logique ; NULL si la ligne est active.",
        sort_order=102,
    )


def table_args(*items: Any, comment: str) -> tuple[Any, ...]:
    """Build `__table_args__` with the French table comment the conventions require."""
    return (*items, {"comment": comment})
