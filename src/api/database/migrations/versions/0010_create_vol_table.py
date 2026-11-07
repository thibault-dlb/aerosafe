"""Create the VOL table.

Revision ID: 0010
Revises: 0009
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "VOL" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "CD_ULID" TEXT NOT NULL,
            "ID_AERONEF" BIGINT NOT NULL,
            "LB_INDICATIF" TEXT,
            "DT_DEBUT" TIMESTAMP WITH TIME ZONE NOT NULL,
            "DT_FIN" TIMESTAMP WITH TIME ZONE,
            "ID_AEROPORT_ORIGINE" BIGINT,
            "ID_AEROPORT_DESTINATION" BIGINT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT pk_vol PRIMARY KEY ("ID"),
            CONSTRAINT ck_vol_ulid_format CHECK ("CD_ULID" ~ '^[0-9A-HJKMNP-TV-Z]{26}$'),
            CONSTRAINT ck_vol_dates_ordered CHECK ("DT_FIN" IS NULL OR "DT_FIN" >= "DT_DEBUT"),
            CONSTRAINT uq_vol_id_id_aeronef UNIQUE ("ID", "ID_AERONEF"),
            CONSTRAINT uq_vol_cd_ulid UNIQUE ("CD_ULID"),
            CONSTRAINT fk_vol_id_aeronef FOREIGN KEY("ID_AERONEF") REFERENCES "AERONEF" ("ID") ON DELETE RESTRICT,
            CONSTRAINT fk_vol_id_aeroport_origine FOREIGN KEY("ID_AEROPORT_ORIGINE") REFERENCES "R_AEROPORT" ("ID") ON DELETE RESTRICT,
            CONSTRAINT fk_vol_id_aeroport_destination FOREIGN KEY("ID_AEROPORT_DESTINATION") REFERENCES "R_AEROPORT" ("ID") ON DELETE RESTRICT
        )
        """
    )
    op.execute("CREATE INDEX idx_vol_aeronef ON \"VOL\" (\"ID_AERONEF\", \"DT_DEBUT\")")
    op.execute("CREATE INDEX idx_vol_aeroport_destination ON \"VOL\" (\"ID_AEROPORT_DESTINATION\")")
    op.execute("CREATE INDEX idx_vol_aeroport_origine ON \"VOL\" (\"ID_AEROPORT_ORIGINE\")")
    op.execute("CREATE TRIGGER trg_vol_updated_at BEFORE UPDATE ON \"VOL\" FOR EACH ROW EXECUTE FUNCTION set_updated_at()")
    op.execute("COMMENT ON TABLE \"VOL\" IS 'Vol d''un aéronef : observations successives séparées d''au plus N minutes (D-06).'")
    op.execute("COMMENT ON COLUMN \"VOL\".\"ID\" IS 'Identifiant technique du vol.'")
    op.execute("COMMENT ON COLUMN \"VOL\".\"CD_ULID\" IS 'Identifiant ULID exposé par l''API, généré par l''application.'")
    op.execute("COMMENT ON COLUMN \"VOL\".\"ID_AERONEF\" IS 'Aéronef qui effectue le vol.'")
    op.execute("COMMENT ON COLUMN \"VOL\".\"LB_INDICATIF\" IS 'Indicatif d''appel radio du vol (callsign OpenSky), si connu.'")
    op.execute("COMMENT ON COLUMN \"VOL\".\"DT_DEBUT\" IS 'Date et heure de la première observation du vol.'")
    op.execute("COMMENT ON COLUMN \"VOL\".\"DT_FIN\" IS 'Date et heure de la dernière observation du vol ; NULL tant que le vol est en cours.'")
    op.execute("COMMENT ON COLUMN \"VOL\".\"ID_AEROPORT_ORIGINE\" IS 'Aéroport de départ ; NULL si inconnu.'")
    op.execute("COMMENT ON COLUMN \"VOL\".\"ID_AEROPORT_DESTINATION\" IS 'Aéroport d''arrivée ; NULL si inconnu.'")
    op.execute("COMMENT ON COLUMN \"VOL\".created_at IS 'Date de création de la ligne.'")
    op.execute("COMMENT ON COLUMN \"VOL\".updated_at IS 'Date de dernière modification de la ligne.'")
    op.execute("COMMENT ON COLUMN \"VOL\".deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"VOL\"")
