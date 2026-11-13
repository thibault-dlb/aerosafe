"""Insert the single row of PARAMETRE_REJEU: no replay started, paused, speed 1.

Revision ID: 0045
Revises: 0044
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0045"
down_revision: str | None = "0044"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("INSERT INTO \"PARAMETRE_REJEU\" (\"NB_VITESSE\", \"BL_EN_PAUSE\") VALUES (1, true)")


def downgrade() -> None:
    op.execute("DELETE FROM \"PARAMETRE_REJEU\"")
