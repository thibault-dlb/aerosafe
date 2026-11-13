"""Create the R_SOURCE_DONNEE table.

Revision ID: 0035
Revises: 0034
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0035"
down_revision: str | None = "0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "R_SOURCE_DONNEE" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "CD_SOURCE_DONNEE" TEXT NOT NULL,
            "LB_SOURCE_DONNEE" TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true NOT NULL,
            CONSTRAINT pk_r_source_donnee PRIMARY KEY ("ID"),
            CONSTRAINT uq_r_source_donnee_cd_source_donnee UNIQUE ("CD_SOURCE_DONNEE")
        )
        """
    )
    op.execute("COMMENT ON TABLE \"R_SOURCE_DONNEE\" IS 'Référentiel des sources de données d''un aéronef : collecte OpenSky en direct ou trafic historique rejoué.'")
    op.execute("COMMENT ON COLUMN \"R_SOURCE_DONNEE\".\"ID\" IS 'Identifiant technique de la source de données.'")
    op.execute("COMMENT ON COLUMN \"R_SOURCE_DONNEE\".\"CD_SOURCE_DONNEE\" IS 'Code stable de la source, utilisé par l''API (DIRECT ou REJEU).'")
    op.execute("COMMENT ON COLUMN \"R_SOURCE_DONNEE\".\"LB_SOURCE_DONNEE\" IS 'Libellé de la source affiché à l''écran.'")
    op.execute("COMMENT ON COLUMN \"R_SOURCE_DONNEE\".is_active IS 'Indique si la source peut encore être utilisée.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"R_SOURCE_DONNEE\"")
