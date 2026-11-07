"""Create the REGLE table.

Revision ID: 0012
Revises: 0011
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "REGLE" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "CD_REGLE" TEXT NOT NULL,
            "LB_DESCRIPTION" TEXT NOT NULL,
            "NB_SEUIL" NUMERIC(10, 3) NOT NULL,
            "ID_UNITE" BIGINT NOT NULL,
            "ID_CRITICITE" BIGINT,
            is_active BOOLEAN DEFAULT true NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT pk_regle PRIMARY KEY ("ID"),
            CONSTRAINT ck_regle_threshold_positive CHECK ("NB_SEUIL" >= 0),
            CONSTRAINT uq_regle_cd_regle UNIQUE ("CD_REGLE"),
            CONSTRAINT fk_regle_id_unite FOREIGN KEY("ID_UNITE") REFERENCES "R_UNITE" ("ID") ON DELETE RESTRICT,
            CONSTRAINT fk_regle_id_criticite FOREIGN KEY("ID_CRITICITE") REFERENCES "R_CRITICITE" ("ID") ON DELETE RESTRICT
        )
        """
    )
    op.execute("CREATE INDEX idx_regle_criticite ON \"REGLE\" (\"ID_CRITICITE\")")
    op.execute("CREATE INDEX idx_regle_unite ON \"REGLE\" (\"ID_UNITE\")")
    op.execute("CREATE TRIGGER trg_regle_updated_at BEFORE UPDATE ON \"REGLE\" FOR EACH ROW EXECUTE FUNCTION set_updated_at()")
    op.execute("COMMENT ON TABLE \"REGLE\" IS 'Règle métier évaluée par le moteur ; le Superviseur peut modifier son seuil (UC-05).'")
    op.execute("COMMENT ON COLUMN \"REGLE\".\"ID\" IS 'Identifiant technique de la règle.'")
    op.execute("COMMENT ON COLUMN \"REGLE\".\"CD_REGLE\" IS 'Code de la règle (R1, R2, ...), libre pour permettre d''en ajouter (NF-06).'")
    op.execute("COMMENT ON COLUMN \"REGLE\".\"LB_DESCRIPTION\" IS 'Description de la situation inhabituelle détectée.'")
    op.execute("COMMENT ON COLUMN \"REGLE\".\"NB_SEUIL\" IS 'Seuil de déclenchement, exprimé dans l''unité de la règle.'")
    op.execute("COMMENT ON COLUMN \"REGLE\".\"ID_UNITE\" IS 'Unité du seuil.'")
    op.execute("COMMENT ON COLUMN \"REGLE\".\"ID_CRITICITE\" IS 'Criticité par défaut recopiée dans les alertes de la règle ; NULL si aucune.'")
    op.execute("COMMENT ON COLUMN \"REGLE\".is_active IS 'Indique si la règle est évaluée par le moteur.'")
    op.execute("COMMENT ON COLUMN \"REGLE\".created_at IS 'Date de création de la ligne.'")
    op.execute("COMMENT ON COLUMN \"REGLE\".updated_at IS 'Date de dernière modification de la ligne.'")
    op.execute("COMMENT ON COLUMN \"REGLE\".deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"REGLE\"")
