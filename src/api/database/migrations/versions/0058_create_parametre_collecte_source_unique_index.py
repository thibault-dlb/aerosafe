"""Create a unique index on PARAMETRE_COLLECTE.ID_SOURCE_DONNEE: one row per source.

It also indexes the foreign key. The table holds a single row, so it is built at once.

Revision ID: 0058
Revises: 0057
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0058"
down_revision: str | None = "0057"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "CREATE UNIQUE INDEX uq_parametre_collecte_source_donnee "
        'ON "PARAMETRE_COLLECTE" ("ID_SOURCE_DONNEE")'
    )


def downgrade() -> None:
    op.execute("DROP INDEX uq_parametre_collecte_source_donnee")
