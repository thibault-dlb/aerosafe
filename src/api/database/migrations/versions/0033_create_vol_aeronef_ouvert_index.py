"""Partial index on the open flights of VOL (DT_FIN IS NULL), by aircraft.

Each collection reads the open flights of the aircraft it received and closes the stale ones.
The open flights are a small part of VOL, so the index stays small. Built concurrently,
outside a transaction.

Revision ID: 0033
Revises: 0032
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0033"
down_revision: str | None = "0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY idx_vol_aeronef_ouvert "
            'ON "VOL" ("ID_AERONEF") WHERE "DT_FIN" IS NULL'
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY idx_vol_aeronef_ouvert")
