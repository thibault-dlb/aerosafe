"""Create the JETON_RAFRAICHISSEMENT table.

Revision ID: 0015
Revises: 0014
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "JETON_RAFRAICHISSEMENT" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "ID_UTILISATEUR" BIGINT NOT NULL,
            "CD_HASH_JETON" TEXT NOT NULL,
            "DT_EXPIRATION" TIMESTAMP WITH TIME ZONE NOT NULL,
            "DT_REVOCATION" TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT pk_jeton_rafraichissement PRIMARY KEY ("ID"),
            CONSTRAINT fk_jeton_rafraichissement_id_utilisateur FOREIGN KEY("ID_UTILISATEUR") REFERENCES "UTILISATEUR" ("ID") ON DELETE RESTRICT,
            CONSTRAINT uq_jeton_rafraichissement_cd_hash_jeton UNIQUE ("CD_HASH_JETON")
        )
        """
    )
    op.execute("CREATE INDEX idx_jeton_utilisateur ON \"JETON_RAFRAICHISSEMENT\" (\"ID_UTILISATEUR\")")
    op.execute("CREATE TRIGGER trg_jeton_updated_at BEFORE UPDATE ON \"JETON_RAFRAICHISSEMENT\" FOR EACH ROW EXECUTE FUNCTION set_updated_at()")
    op.execute("COMMENT ON TABLE \"JETON_RAFRAICHISSEMENT\" IS 'Jeton de rafraîchissement émis à la connexion ; seule son empreinte est stockée.'")
    op.execute("COMMENT ON COLUMN \"JETON_RAFRAICHISSEMENT\".\"ID\" IS 'Identifiant technique du jeton.'")
    op.execute("COMMENT ON COLUMN \"JETON_RAFRAICHISSEMENT\".\"ID_UTILISATEUR\" IS 'Utilisateur propriétaire du jeton.'")
    op.execute("COMMENT ON COLUMN \"JETON_RAFRAICHISSEMENT\".\"CD_HASH_JETON\" IS 'Empreinte du jeton ; le jeton lui-même reste dans un cookie HttpOnly.'")
    op.execute("COMMENT ON COLUMN \"JETON_RAFRAICHISSEMENT\".\"DT_EXPIRATION\" IS 'Date d''expiration du jeton.'")
    op.execute("COMMENT ON COLUMN \"JETON_RAFRAICHISSEMENT\".\"DT_REVOCATION\" IS 'Date de révocation (déconnexion, désactivation, anonymisation) ; NULL si le jeton est valide.'")
    op.execute("COMMENT ON COLUMN \"JETON_RAFRAICHISSEMENT\".created_at IS 'Date de création de la ligne.'")
    op.execute("COMMENT ON COLUMN \"JETON_RAFRAICHISSEMENT\".updated_at IS 'Date de dernière modification de la ligne.'")
    op.execute("COMMENT ON COLUMN \"JETON_RAFRAICHISSEMENT\".deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"JETON_RAFRAICHISSEMENT\"")
