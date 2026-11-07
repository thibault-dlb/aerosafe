"""Create the R_AEROPORT table.

Revision ID: 0008
Revises: 0007
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "R_AEROPORT" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "CD_AEROPORT" TEXT NOT NULL,
            "LB_AEROPORT" TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true NOT NULL,
            CONSTRAINT pk_r_aeroport PRIMARY KEY ("ID"),
            CONSTRAINT uq_r_aeroport_cd_aeroport UNIQUE ("CD_AEROPORT")
        )
        """
    )
    op.execute("COMMENT ON TABLE \"R_AEROPORT\" IS 'Référentiel des aéroports de départ et d''arrivée des vols.'")
    op.execute("COMMENT ON COLUMN \"R_AEROPORT\".\"ID\" IS 'Identifiant technique de l''aéroport.'")
    op.execute("COMMENT ON COLUMN \"R_AEROPORT\".\"CD_AEROPORT\" IS 'Code de l''aéroport (clé métier).'")
    op.execute("COMMENT ON COLUMN \"R_AEROPORT\".\"LB_AEROPORT\" IS 'Nom de l''aéroport.'")
    op.execute("COMMENT ON COLUMN \"R_AEROPORT\".is_active IS 'Indique si l''aéroport peut encore être utilisé.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"R_AEROPORT\"")
