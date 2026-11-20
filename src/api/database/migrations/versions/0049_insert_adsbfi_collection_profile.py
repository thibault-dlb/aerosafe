"""Insert the collection profile of adsb.fi: a circle of 250 NM around Paris, every 5 s.

Revision ID: 0049
Revises: 0048
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0049"
down_revision: str | None = "0048"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO "R_PROFIL_COLLECTE" ("CD_PROFIL_COLLECTE", "LB_PROFIL_COLLECTE") VALUES
            ('ADSBFI_250NM', 'adsb.fi, 250 NM autour de Paris, toutes les 5 s')
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM \"R_PROFIL_COLLECTE\" WHERE \"CD_PROFIL_COLLECTE\" = 'ADSBFI_250NM'"
    )
