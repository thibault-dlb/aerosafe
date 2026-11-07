"""Insert rules R1 to R5. Their thresholds are a proposal (D-04).

Revision ID: 0022
Revises: 0021
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO "REGLE" ("CD_REGLE", "LB_DESCRIPTION", "NB_SEUIL", "ID_UNITE", "ID_CRITICITE")
        SELECT v.code, v.description, v.seuil, u."ID", c."ID"
        FROM (VALUES
            ('R1', 'Délai trop long depuis le dernier contact', 300, 's', 'MEDIUM'),
            ('R2', 'Position devenue trop ancienne', 600, 's', 'LOW'),
            ('R3', 'Variation importante d''altitude', 30, 'm/s', 'HIGH'),
            ('R4', 'Variation importante de vitesse', 2, 'm/s²', 'MEDIUM'),
            ('R5', 'Variation importante de cap', 5, '°/s', 'MEDIUM')
        ) AS v (code, description, seuil, unite, criticite)
        JOIN "R_UNITE" u ON u."CD_UNITE" = v.unite
        JOIN "R_CRITICITE" c ON c."CD_CRITICITE" = v.criticite
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM \"REGLE\" WHERE \"CD_REGLE\" IN ('R1', 'R2', 'R3', 'R4', 'R5')")
