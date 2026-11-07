"""Create the ALERTE table.

Revision ID: 0014
Revises: 0013
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "ALERTE" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "CD_ULID" TEXT NOT NULL,
            "ID_AERONEF" BIGINT NOT NULL,
            "ID_REGLE" BIGINT NOT NULL,
            "DT_DECLENCHEMENT" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            "DT_FIN_EPISODE" TIMESTAMP WITH TIME ZONE,
            "NB_VALEUR_OBSERVEE" NUMERIC(12, 3),
            "NB_SEUIL" NUMERIC(10, 3),
            "LB_MESSAGE" TEXT NOT NULL,
            "ID_CRITICITE" BIGINT,
            "DT_TRAITEMENT" TIMESTAMP WITH TIME ZONE,
            "ID_UTILISATEUR" BIGINT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT pk_alerte PRIMARY KEY ("ID"),
            CONSTRAINT ck_alerte_ulid_format CHECK ("CD_ULID" ~ '^[0-9A-HJKMNP-TV-Z]{26}$'),
            CONSTRAINT ck_alerte_processing_complete CHECK (("DT_TRAITEMENT" IS NULL) = ("ID_UTILISATEUR" IS NULL)),
            CONSTRAINT ck_alerte_episode_ordered CHECK ("DT_FIN_EPISODE" IS NULL OR "DT_FIN_EPISODE" >= "DT_DECLENCHEMENT"),
            CONSTRAINT uq_alerte_cd_ulid UNIQUE ("CD_ULID"),
            CONSTRAINT fk_alerte_id_aeronef FOREIGN KEY("ID_AERONEF") REFERENCES "AERONEF" ("ID") ON DELETE RESTRICT,
            CONSTRAINT fk_alerte_id_regle FOREIGN KEY("ID_REGLE") REFERENCES "REGLE" ("ID") ON DELETE RESTRICT,
            CONSTRAINT fk_alerte_id_criticite FOREIGN KEY("ID_CRITICITE") REFERENCES "R_CRITICITE" ("ID") ON DELETE RESTRICT,
            CONSTRAINT fk_alerte_id_utilisateur FOREIGN KEY("ID_UTILISATEUR") REFERENCES "UTILISATEUR" ("ID") ON DELETE RESTRICT
        )
        """
    )
    op.execute("CREATE INDEX idx_alerte_aeronef ON \"ALERTE\" (\"ID_AERONEF\")")
    op.execute("CREATE INDEX idx_alerte_criticite ON \"ALERTE\" (\"ID_CRITICITE\")")
    op.execute("CREATE INDEX idx_alerte_declenchement ON \"ALERTE\" (\"DT_DECLENCHEMENT\")")
    op.execute("CREATE INDEX idx_alerte_regle ON \"ALERTE\" (\"ID_REGLE\")")
    op.execute("CREATE INDEX idx_alerte_utilisateur ON \"ALERTE\" (\"ID_UTILISATEUR\")")
    op.execute("CREATE UNIQUE INDEX uq_alerte_episode_ouvert ON \"ALERTE\" (\"ID_AERONEF\", \"ID_REGLE\") WHERE \"DT_FIN_EPISODE\" IS NULL AND deleted_at IS NULL")
    op.execute("CREATE TRIGGER trg_alerte_updated_at BEFORE UPDATE ON \"ALERTE\" FOR EACH ROW EXECUTE FUNCTION set_updated_at()")
    op.execute("COMMENT ON TABLE \"ALERTE\" IS 'Alerte générée par le moteur quand une règle se déclenche pour un aéronef.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".\"ID\" IS 'Identifiant technique de l''alerte.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".\"CD_ULID\" IS 'Identifiant ULID exposé par l''API, généré par l''application.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".\"ID_AERONEF\" IS 'Aéronef concerné.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".\"ID_REGLE\" IS 'Règle déclenchée.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".\"DT_DECLENCHEMENT\" IS 'Date et heure du déclenchement.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".\"DT_FIN_EPISODE\" IS 'Date de fin de la situation ; NULL tant qu''elle dure, ce qui empêche une nouvelle alerte de la même règle pour cet aéronef.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".\"NB_VALEUR_OBSERVEE\" IS 'Valeur mesurée qui a dépassé le seuil, dans l''unité de la règle.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".\"NB_SEUIL\" IS 'Seuil en vigueur au déclenchement, recopié pour que l''alerte reste explicable.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".\"LB_MESSAGE\" IS 'Message explicatif de l''alerte.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".\"ID_CRITICITE\" IS 'Criticité de l''alerte ; NULL si aucune.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".\"DT_TRAITEMENT\" IS 'Date à laquelle l''alerte a été marquée comme traitée ; NULL si non traitée.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".\"ID_UTILISATEUR\" IS 'Superviseur qui a traité l''alerte ; NULL si non traitée.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".created_at IS 'Date de création de la ligne.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".updated_at IS 'Date de dernière modification de la ligne.'")
    op.execute("COMMENT ON COLUMN \"ALERTE\".deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"ALERTE\"")
