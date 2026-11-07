"""Create the AERONEF table.

Revision ID: 0009
Revises: 0008
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "AERONEF" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "CD_ULID" TEXT NOT NULL,
            "CD_ICAO24" TEXT NOT NULL,
            "LB_IMMATRICULATION" TEXT,
            "ID_MODELE" BIGINT,
            "ID_COMPAGNIE" BIGINT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT pk_aeronef PRIMARY KEY ("ID"),
            CONSTRAINT ck_aeronef_ulid_format CHECK ("CD_ULID" ~ '^[0-9A-HJKMNP-TV-Z]{26}$'),
            CONSTRAINT ck_aeronef_icao24_format CHECK ("CD_ICAO24" ~ '^[0-9a-f]{6}$'),
            CONSTRAINT uq_aeronef_cd_ulid UNIQUE ("CD_ULID"),
            CONSTRAINT uq_aeronef_cd_icao24 UNIQUE ("CD_ICAO24"),
            CONSTRAINT fk_aeronef_id_modele FOREIGN KEY("ID_MODELE") REFERENCES "R_MODELE" ("ID") ON DELETE RESTRICT,
            CONSTRAINT fk_aeronef_id_compagnie FOREIGN KEY("ID_COMPAGNIE") REFERENCES "R_COMPAGNIE" ("ID") ON DELETE RESTRICT
        )
        """
    )
    op.execute("CREATE INDEX idx_aeronef_compagnie ON \"AERONEF\" (\"ID_COMPAGNIE\")")
    op.execute("CREATE INDEX idx_aeronef_immatriculation_trgm ON \"AERONEF\" USING gin (\"LB_IMMATRICULATION\" gin_trgm_ops)")
    op.execute("CREATE INDEX idx_aeronef_modele ON \"AERONEF\" (\"ID_MODELE\")")
    op.execute("CREATE TRIGGER trg_aeronef_updated_at BEFORE UPDATE ON \"AERONEF\" FOR EACH ROW EXECUTE FUNCTION set_updated_at()")
    op.execute("COMMENT ON TABLE \"AERONEF\" IS 'Aéronef suivi, créé par le collecteur OpenSky à la première observation de son code ICAO24.'")
    op.execute("COMMENT ON COLUMN \"AERONEF\".\"ID\" IS 'Identifiant technique de l''aéronef.'")
    op.execute("COMMENT ON COLUMN \"AERONEF\".\"CD_ULID\" IS 'Identifiant ULID exposé par l''API, généré par l''application.'")
    op.execute("COMMENT ON COLUMN \"AERONEF\".\"CD_ICAO24\" IS 'Adresse ICAO24 du transpondeur, 6 caractères hexadécimaux en minuscules (clé métier).'")
    op.execute("COMMENT ON COLUMN \"AERONEF\".\"LB_IMMATRICULATION\" IS 'Immatriculation de l''aéronef, si connue.'")
    op.execute("COMMENT ON COLUMN \"AERONEF\".\"ID_MODELE\" IS 'Modèle de l''aéronef ; NULL si inconnu.'")
    op.execute("COMMENT ON COLUMN \"AERONEF\".\"ID_COMPAGNIE\" IS 'Compagnie exploitant l''aéronef ; NULL si inconnue.'")
    op.execute("COMMENT ON COLUMN \"AERONEF\".created_at IS 'Date de création de la ligne.'")
    op.execute("COMMENT ON COLUMN \"AERONEF\".updated_at IS 'Date de dernière modification de la ligne.'")
    op.execute("COMMENT ON COLUMN \"AERONEF\".deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"AERONEF\"")
