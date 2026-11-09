"""Insert the collection profiles.

Revision ID: 0027
Revises: 0026
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0027"
down_revision: str | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO "R_PROFIL_COLLECTE" ("CD_PROFIL_COLLECTE", "LB_PROFIL_COLLECTE") VALUES
            ('ILE_DE_FRANCE', 'Île-de-France, toutes les 30 s'),
            ('FRANCE', 'France métropolitaine, toutes les 120 s')
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM \"R_PROFIL_COLLECTE\" WHERE \"CD_PROFIL_COLLECTE\" IN ('ILE_DE_FRANCE', 'FRANCE')"
    )
