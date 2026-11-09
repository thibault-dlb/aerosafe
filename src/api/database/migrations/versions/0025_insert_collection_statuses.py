"""Insert the collection statuses.

Revision ID: 0025
Revises: 0024
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0025"
down_revision: str | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO "R_STATUT_COLLECTE" ("CD_STATUT_COLLECTE", "LB_STATUT_COLLECTE") VALUES
            ('SUCCESS', 'Succès'),
            ('PARTIAL', 'Partiel'),
            ('FAILED', 'Échec'),
            ('RATE_LIMITED', 'Quota OpenSky atteint'),
            ('SKIPPED', 'Ignorée, collecte en pause')
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM \"R_STATUT_COLLECTE\" WHERE \"CD_STATUT_COLLECTE\" IN "
        "('SUCCESS', 'PARTIAL', 'FAILED', 'RATE_LIMITED', 'SKIPPED')"
    )
