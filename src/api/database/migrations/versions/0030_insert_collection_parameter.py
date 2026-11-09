"""Insert the single row of PARAMETRE_COLLECTE: collection not paused.

Revision ID: 0030
Revises: 0029
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0030"
down_revision: str | None = "0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("INSERT INTO \"PARAMETRE_COLLECTE\" (\"BL_EN_PAUSE\") VALUES (false)")


def downgrade() -> None:
    op.execute("DELETE FROM \"PARAMETRE_COLLECTE\"")
