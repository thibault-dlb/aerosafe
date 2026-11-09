"""Index OBSERVATION on (ID_VOL, DT_DERNIER_CONTACT) for the latest contact of each flight.

Each collection takes max(DT_DERNIER_CONTACT) per open flight to group the observations and
close the stale flights (D-06); the (ID_VOL, DT_POSITION) index does not cover it. Built
concurrently, outside a transaction, since OBSERVATION is the largest table.

Revision ID: 0034
Revises: 0033
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0034"
down_revision: str | None = "0033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY idx_observation_vol_contact "
            'ON "OBSERVATION" ("ID_VOL", "DT_DERNIER_CONTACT")'
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY idx_observation_vol_contact")
