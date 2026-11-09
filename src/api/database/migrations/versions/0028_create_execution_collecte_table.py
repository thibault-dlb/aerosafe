"""Create the EXECUTION_COLLECTE table.

Revision ID: 0028
Revises: 0027
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0028"
down_revision: str | None = "0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "EXECUTION_COLLECTE" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "DT_DEBUT" TIMESTAMP WITH TIME ZONE NOT NULL,
            "DT_FIN" TIMESTAMP WITH TIME ZONE,
            "ID_STATUT_COLLECTE" BIGINT NOT NULL,
            "ID_PROFIL_COLLECTE" BIGINT NOT NULL,
            "NB_ETATS_RECUS" INTEGER DEFAULT 0 NOT NULL,
            "NB_ETATS_STOCKES" INTEGER DEFAULT 0 NOT NULL,
            "NB_ETATS_REJETES" INTEGER DEFAULT 0 NOT NULL,
            "NB_CREDITS_RESTANTS" INTEGER,
            "LB_ERREUR" TEXT,
            "LB_ERREUR_EVALUATION" TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT pk_execution_collecte PRIMARY KEY ("ID"),
            CONSTRAINT ck_execution_collecte_dates_ordered CHECK ("DT_FIN" IS NULL OR "DT_FIN" >= "DT_DEBUT"),
            CONSTRAINT ck_execution_collecte_counts_not_negative CHECK ("NB_ETATS_RECUS" >= 0 AND "NB_ETATS_STOCKES" >= 0 AND "NB_ETATS_REJETES" >= 0),
            CONSTRAINT fk_execution_collecte_id_statut_collecte FOREIGN KEY("ID_STATUT_COLLECTE") REFERENCES "R_STATUT_COLLECTE" ("ID") ON DELETE RESTRICT,
            CONSTRAINT fk_execution_collecte_id_profil_collecte FOREIGN KEY("ID_PROFIL_COLLECTE") REFERENCES "R_PROFIL_COLLECTE" ("ID") ON DELETE RESTRICT
        )
        """
    )
    op.execute("CREATE INDEX idx_execution_collecte_debut ON \"EXECUTION_COLLECTE\" (\"DT_DEBUT\")")
    op.execute("CREATE INDEX idx_execution_collecte_statut ON \"EXECUTION_COLLECTE\" (\"ID_STATUT_COLLECTE\")")
    op.execute("CREATE INDEX idx_execution_collecte_profil ON \"EXECUTION_COLLECTE\" (\"ID_PROFIL_COLLECTE\")")
    op.execute("CREATE TRIGGER trg_execution_collecte_updated_at BEFORE UPDATE ON \"EXECUTION_COLLECTE\" FOR EACH ROW EXECUTE FUNCTION set_updated_at()")
    op.execute("COMMENT ON TABLE \"EXECUTION_COLLECTE\" IS 'Cycle de collecte OpenSky, une ligne par cycle créée par le collecteur ; figée une fois DT_FIN renseignée.'")
    op.execute("COMMENT ON COLUMN \"EXECUTION_COLLECTE\".\"ID\" IS 'Identifiant technique du cycle de collecte.'")
    op.execute("COMMENT ON COLUMN \"EXECUTION_COLLECTE\".\"DT_DEBUT\" IS 'Début du cycle ; c''est aussi l''instant transmis au moteur de règles pour l''évaluation.'")
    op.execute("COMMENT ON COLUMN \"EXECUTION_COLLECTE\".\"DT_FIN\" IS 'Fin du cycle ; NULL tant que le cycle est en cours.'")
    op.execute("COMMENT ON COLUMN \"EXECUTION_COLLECTE\".\"ID_STATUT_COLLECTE\" IS 'Statut du cycle de collecte.'")
    op.execute("COMMENT ON COLUMN \"EXECUTION_COLLECTE\".\"ID_PROFIL_COLLECTE\" IS 'Profil de collecte utilisé pendant le cycle.'")
    op.execute("COMMENT ON COLUMN \"EXECUTION_COLLECTE\".\"NB_ETATS_RECUS\" IS 'Nombre de vecteurs d''état reçus d''OpenSky.'")
    op.execute("COMMENT ON COLUMN \"EXECUTION_COLLECTE\".\"NB_ETATS_STOCKES\" IS 'Nombre de vecteurs d''état enregistrés comme observations.'")
    op.execute("COMMENT ON COLUMN \"EXECUTION_COLLECTE\".\"NB_ETATS_REJETES\" IS 'Nombre de vecteurs d''état rejetés par le nettoyage ou la validation.'")
    op.execute("COMMENT ON COLUMN \"EXECUTION_COLLECTE\".\"NB_CREDITS_RESTANTS\" IS 'Crédits OpenSky restants selon l''en-tête X-Rate-Limit-Remaining ; NULL si absent.'")
    op.execute("COMMENT ON COLUMN \"EXECUTION_COLLECTE\".\"LB_ERREUR\" IS 'Erreur de la collecte ; NULL si aucune.'")
    op.execute("COMMENT ON COLUMN \"EXECUTION_COLLECTE\".\"LB_ERREUR_EVALUATION\" IS 'Erreur levée par le moteur de règles après la collecte, qui reste valide ; NULL si aucune.'")
    op.execute("COMMENT ON COLUMN \"EXECUTION_COLLECTE\".created_at IS 'Date de création de la ligne.'")
    op.execute("COMMENT ON COLUMN \"EXECUTION_COLLECTE\".updated_at IS 'Date de dernière modification de la ligne.'")
    op.execute("COMMENT ON COLUMN \"EXECUTION_COLLECTE\".deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"EXECUTION_COLLECTE\"")
