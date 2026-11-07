"""Create the R_COMPAGNIE table.

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "R_COMPAGNIE" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "CD_COMPAGNIE" TEXT NOT NULL,
            "LB_COMPAGNIE" TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true NOT NULL,
            CONSTRAINT pk_r_compagnie PRIMARY KEY ("ID"),
            CONSTRAINT uq_r_compagnie_cd_compagnie UNIQUE ("CD_COMPAGNIE")
        )
        """
    )
    op.execute("CREATE INDEX idx_compagnie_libelle_trgm ON \"R_COMPAGNIE\" USING gin (\"LB_COMPAGNIE\" gin_trgm_ops)")
    op.execute("COMMENT ON TABLE \"R_COMPAGNIE\" IS 'Référentiel des compagnies exploitantes, alimenté par la base de métadonnées OpenSky.'")
    op.execute("COMMENT ON COLUMN \"R_COMPAGNIE\".\"ID\" IS 'Identifiant technique de la compagnie.'")
    op.execute("COMMENT ON COLUMN \"R_COMPAGNIE\".\"CD_COMPAGNIE\" IS 'Code de la compagnie (clé métier).'")
    op.execute("COMMENT ON COLUMN \"R_COMPAGNIE\".\"LB_COMPAGNIE\" IS 'Nom de la compagnie, utilisé par la recherche d''aéronefs.'")
    op.execute("COMMENT ON COLUMN \"R_COMPAGNIE\".is_active IS 'Indique si la compagnie peut encore être utilisée.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"R_COMPAGNIE\"")
