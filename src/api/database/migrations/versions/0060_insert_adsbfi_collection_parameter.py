"""Insert the parameter row of the adsb.fi collection, not paused.

Revision ID: 0060
Revises: 0059
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0060"
down_revision: str | None = "0059"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO "PARAMETRE_COLLECTE" ("BL_EN_PAUSE", "ID_SOURCE_DONNEE")
        SELECT false, "ID" FROM "R_SOURCE_DONNEE" WHERE "CD_SOURCE_DONNEE" = 'ADSBFI'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM "PARAMETRE_COLLECTE" WHERE "ID_SOURCE_DONNEE" =
            (SELECT "ID" FROM "R_SOURCE_DONNEE" WHERE "CD_SOURCE_DONNEE" = 'ADSBFI')
        """
    )
