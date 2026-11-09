"""Create the R_PROFIL_COLLECTE table.

Revision ID: 0026
Revises: 0025
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0026"
down_revision: str | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "R_PROFIL_COLLECTE" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "CD_PROFIL_COLLECTE" TEXT NOT NULL,
            "LB_PROFIL_COLLECTE" TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true NOT NULL,
            CONSTRAINT pk_r_profil_collecte PRIMARY KEY ("ID"),
            CONSTRAINT uq_r_profil_collecte_cd_profil_collecte UNIQUE ("CD_PROFIL_COLLECTE")
        )
        """
    )
    op.execute("COMMENT ON TABLE \"R_PROFIL_COLLECTE\" IS 'Référentiel des profils de collecte OpenSky (zone couverte et fréquence), choisis par configuration.'")
    op.execute("COMMENT ON COLUMN \"R_PROFIL_COLLECTE\".\"ID\" IS 'Identifiant technique du profil de collecte.'")
    op.execute("COMMENT ON COLUMN \"R_PROFIL_COLLECTE\".\"CD_PROFIL_COLLECTE\" IS 'Code stable du profil, valeur du paramètre COLLECTION_PROFILE.'")
    op.execute("COMMENT ON COLUMN \"R_PROFIL_COLLECTE\".\"LB_PROFIL_COLLECTE\" IS 'Libellé du profil affiché sur le tableau de bord.'")
    op.execute("COMMENT ON COLUMN \"R_PROFIL_COLLECTE\".is_active IS 'Indique si le profil peut encore être utilisé.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"R_PROFIL_COLLECTE\"")
