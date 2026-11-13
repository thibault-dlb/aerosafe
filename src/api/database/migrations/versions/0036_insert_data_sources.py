"""Insert the data sources.

DIRECT is inserted first: it is the key 1 that 0037 gives as the default source of an aircraft.

Revision ID: 0036
Revises: 0035
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0036"
down_revision: str | None = "0035"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO "R_SOURCE_DONNEE" ("CD_SOURCE_DONNEE", "LB_SOURCE_DONNEE") VALUES
            ('DIRECT', 'Collecte OpenSky en direct'),
            ('REJEU', 'Trafic historique rejoué')
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM \"R_SOURCE_DONNEE\" WHERE \"CD_SOURCE_DONNEE\" IN ('DIRECT', 'REJEU')"
    )
