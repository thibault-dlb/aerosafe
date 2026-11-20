"""Drop the unique index on a constant of PARAMETRE_COLLECTE: one row per source from now on.

The unique index of 0058 now keeps a single row for each source.

Revision ID: 0059
Revises: 0058
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0059"
down_revision: str | None = "0058"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DROP INDEX uq_parametre_collecte_ligne_unique")


def downgrade() -> None:
    # Only one row may remain: 0060 deletes the adsb.fi one first when it is downgraded.
    op.execute(
        'CREATE UNIQUE INDEX uq_parametre_collecte_ligne_unique ON "PARAMETRE_COLLECTE" ((true))'
    )
