"""Create the R_MODELE table.

Revision ID: 0006
Revises: 0005
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "R_MODELE" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "CD_MODELE" TEXT NOT NULL,
            "LB_MODELE" TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true NOT NULL,
            CONSTRAINT pk_r_modele PRIMARY KEY ("ID"),
            CONSTRAINT uq_r_modele_cd_modele UNIQUE ("CD_MODELE")
        )
        """
    )
    op.execute("COMMENT ON TABLE \"R_MODELE\" IS 'Référentiel des modèles d''aéronefs, alimenté par la base de métadonnées OpenSky.'")
    op.execute("COMMENT ON COLUMN \"R_MODELE\".\"ID\" IS 'Identifiant technique du modèle.'")
    op.execute("COMMENT ON COLUMN \"R_MODELE\".\"CD_MODELE\" IS 'Code du type d''aéronef (clé métier).'")
    op.execute("COMMENT ON COLUMN \"R_MODELE\".\"LB_MODELE\" IS 'Libellé complet du modèle.'")
    op.execute("COMMENT ON COLUMN \"R_MODELE\".is_active IS 'Indique si le modèle peut encore être utilisé.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"R_MODELE\"")
