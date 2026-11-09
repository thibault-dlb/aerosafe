"""Create the R_STATUT_COLLECTE table.

Revision ID: 0024
Revises: 0023
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "R_STATUT_COLLECTE" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "CD_STATUT_COLLECTE" TEXT NOT NULL,
            "LB_STATUT_COLLECTE" TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true NOT NULL,
            CONSTRAINT pk_r_statut_collecte PRIMARY KEY ("ID"),
            CONSTRAINT uq_r_statut_collecte_cd_statut_collecte UNIQUE ("CD_STATUT_COLLECTE")
        )
        """
    )
    op.execute("COMMENT ON TABLE \"R_STATUT_COLLECTE\" IS 'Référentiel des statuts d''un cycle de collecte OpenSky (succès, partiel, échec, quota atteint, ignoré).'")
    op.execute("COMMENT ON COLUMN \"R_STATUT_COLLECTE\".\"ID\" IS 'Identifiant technique du statut de collecte.'")
    op.execute("COMMENT ON COLUMN \"R_STATUT_COLLECTE\".\"CD_STATUT_COLLECTE\" IS 'Code stable du statut, utilisé par le collecteur.'")
    op.execute("COMMENT ON COLUMN \"R_STATUT_COLLECTE\".\"LB_STATUT_COLLECTE\" IS 'Libellé du statut affiché sur le tableau de bord.'")
    op.execute("COMMENT ON COLUMN \"R_STATUT_COLLECTE\".is_active IS 'Indique si le statut peut encore être utilisé.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"R_STATUT_COLLECTE\"")
