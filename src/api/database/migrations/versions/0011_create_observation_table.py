"""Create the OBSERVATION table.

Revision ID: 0011
Revises: 0010
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "OBSERVATION" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "ID_AERONEF" BIGINT NOT NULL,
            "ID_VOL" BIGINT,
            "DT_DERNIER_CONTACT" TIMESTAMP WITH TIME ZONE NOT NULL,
            "DT_POSITION" TIMESTAMP WITH TIME ZONE,
            "GEO_POSITION" geometry(POINT,4326),
            "NB_ALTITUDE" NUMERIC(7, 1),
            "NB_VITESSE" NUMERIC(6, 2),
            "NB_CAP" NUMERIC(5, 2),
            "BL_AU_SOL" BOOLEAN NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT pk_observation PRIMARY KEY ("ID"),
            CONSTRAINT uq_observation_id_aeronef_dt_dernier_contact UNIQUE ("ID_AERONEF", "DT_DERNIER_CONTACT"),
            CONSTRAINT fk_observation_id_vol_id_aeronef FOREIGN KEY("ID_VOL", "ID_AERONEF") REFERENCES "VOL" ("ID", "ID_AERONEF") ON DELETE RESTRICT,
            CONSTRAINT ck_observation_position_before_contact CHECK ("DT_POSITION" IS NULL OR "DT_POSITION" <= "DT_DERNIER_CONTACT"),
            CONSTRAINT ck_observation_speed_positive CHECK ("NB_VITESSE" >= 0),
            CONSTRAINT ck_observation_heading_range CHECK ("NB_CAP" >= 0 AND "NB_CAP" < 360),
            CONSTRAINT fk_observation_id_aeronef FOREIGN KEY("ID_AERONEF") REFERENCES "AERONEF" ("ID") ON DELETE RESTRICT
        )
        """
    )
    op.execute("CREATE INDEX idx_observation_contact ON \"OBSERVATION\" (\"DT_DERNIER_CONTACT\")")
    op.execute("CREATE INDEX idx_observation_position ON \"OBSERVATION\" USING gist (\"GEO_POSITION\")")
    op.execute("CREATE INDEX idx_observation_vol ON \"OBSERVATION\" (\"ID_VOL\", \"DT_POSITION\")")
    op.execute("CREATE TRIGGER trg_observation_updated_at BEFORE UPDATE ON \"OBSERVATION\" FOR EACH ROW EXECUTE FUNCTION set_updated_at()")
    op.execute("COMMENT ON TABLE \"OBSERVATION\" IS 'Vecteur d''état d''un aéronef reçu d''OpenSky, nettoyé puis stocké par le collecteur.'")
    op.execute("COMMENT ON COLUMN \"OBSERVATION\".\"ID\" IS 'Identifiant technique de l''observation.'")
    op.execute("COMMENT ON COLUMN \"OBSERVATION\".\"ID_AERONEF\" IS 'Aéronef observé.'")
    op.execute("COMMENT ON COLUMN \"OBSERVATION\".\"ID_VOL\" IS 'Vol auquel l''observation est rattachée, forcément du même aéronef ; NULL si elle n''appartient à aucun vol.'")
    op.execute("COMMENT ON COLUMN \"OBSERVATION\".\"DT_DERNIER_CONTACT\" IS 'Date du dernier message reçu de l''aéronef (last_contact OpenSky), utilisée par R1.'")
    op.execute("COMMENT ON COLUMN \"OBSERVATION\".\"DT_POSITION\" IS 'Date de la dernière position connue (time_position OpenSky), utilisée par R2 ; NULL sans position.'")
    op.execute("COMMENT ON COLUMN \"OBSERVATION\".\"GEO_POSITION\" IS 'Position géographique (point PostGIS, WGS 84) ; NULL sans position.'")
    op.execute("COMMENT ON COLUMN \"OBSERVATION\".\"NB_ALTITUDE\" IS 'Altitude en mètres.'")
    op.execute("COMMENT ON COLUMN \"OBSERVATION\".\"NB_VITESSE\" IS 'Vitesse sol en mètres par seconde.'")
    op.execute("COMMENT ON COLUMN \"OBSERVATION\".\"NB_CAP\" IS 'Cap vrai en degrés, de 0 inclus à 360 exclu.'")
    op.execute("COMMENT ON COLUMN \"OBSERVATION\".\"BL_AU_SOL\" IS 'Vrai si l''aéronef est au sol (on_ground OpenSky) ; les règles ne portent que sur les aéronefs en vol.'")
    op.execute("COMMENT ON COLUMN \"OBSERVATION\".created_at IS 'Date de création de la ligne.'")
    op.execute("COMMENT ON COLUMN \"OBSERVATION\".updated_at IS 'Date de dernière modification de la ligne.'")
    op.execute("COMMENT ON COLUMN \"OBSERVATION\".deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"OBSERVATION\"")
