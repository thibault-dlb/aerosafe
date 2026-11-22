"""Insert the source ADSBFI: the live collection from the adsb.fi open data API.

It runs next to the OpenSky collection (DIRECT) and the replay (REJEU). Its aircraft, flights,
observations and alerts are kept apart from the other sources, as the replayed ones are.

Revision ID: 0048
Revises: 0047
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0048"
down_revision: str | None = "0047"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO "R_SOURCE_DONNEE" ("CD_SOURCE_DONNEE", "LB_SOURCE_DONNEE") VALUES
            ('ADSBFI', 'Collecte adsb.fi en direct')
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM \"R_SOURCE_DONNEE\" WHERE \"CD_SOURCE_DONNEE\" = 'ADSBFI'")
