"""Create the UTILISATEUR table.

Revision ID: 0013
Revises: 0012
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "UTILISATEUR" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "LN_EMAIL" TEXT NOT NULL,
            "LB_HASH_MOT_DE_PASSE" TEXT,
            "ID_ROLE" BIGINT NOT NULL,
            "DT_ANONYMISATION" TIMESTAMP WITH TIME ZONE,
            is_active BOOLEAN DEFAULT true NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT pk_utilisateur PRIMARY KEY ("ID"),
            CONSTRAINT ck_utilisateur_password_unless_anonymised CHECK ("LB_HASH_MOT_DE_PASSE" IS NOT NULL OR "DT_ANONYMISATION" IS NOT NULL),
            CONSTRAINT uq_utilisateur_ln_email UNIQUE ("LN_EMAIL"),
            CONSTRAINT fk_utilisateur_id_role FOREIGN KEY("ID_ROLE") REFERENCES "R_ROLE" ("ID") ON DELETE RESTRICT
        )
        """
    )
    op.execute("CREATE INDEX idx_utilisateur_role ON \"UTILISATEUR\" (\"ID_ROLE\")")
    op.execute("CREATE TRIGGER trg_utilisateur_updated_at BEFORE UPDATE ON \"UTILISATEUR\" FOR EACH ROW EXECUTE FUNCTION set_updated_at()")
    op.execute("COMMENT ON TABLE \"UTILISATEUR\" IS 'Compte applicatif, créé à l''inscription ; anonymisé sur demande, jamais supprimé.'")
    op.execute("COMMENT ON COLUMN \"UTILISATEUR\".\"ID\" IS 'Identifiant technique de l''utilisateur.'")
    op.execute("COMMENT ON COLUMN \"UTILISATEUR\".\"LN_EMAIL\" IS 'Adresse e-mail de connexion, unique ; remplacée à l''anonymisation par anonyme-<ID>@aerosafe.invalid.'")
    op.execute("COMMENT ON COLUMN \"UTILISATEUR\".\"LB_HASH_MOT_DE_PASSE\" IS 'Empreinte argon2id du mot de passe ; NULL seulement après anonymisation.'")
    op.execute("COMMENT ON COLUMN \"UTILISATEUR\".\"ID_ROLE\" IS 'Rôle de l''utilisateur.'")
    op.execute("COMMENT ON COLUMN \"UTILISATEUR\".\"DT_ANONYMISATION\" IS 'Date d''anonymisation du compte ; NULL si le compte n''est pas anonymisé.'")
    op.execute("COMMENT ON COLUMN \"UTILISATEUR\".is_active IS 'Indique si le compte peut se connecter.'")
    op.execute("COMMENT ON COLUMN \"UTILISATEUR\".created_at IS 'Date de création de la ligne.'")
    op.execute("COMMENT ON COLUMN \"UTILISATEUR\".updated_at IS 'Date de dernière modification de la ligne.'")
    op.execute("COMMENT ON COLUMN \"UTILISATEUR\".deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"UTILISATEUR\"")
