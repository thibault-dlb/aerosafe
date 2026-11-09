"""Create the PARAMETRE_COLLECTE table.

The table holds a single row. A unique index on a constant expression rejects a second row,
whatever the values inserted.

Revision ID: 0029
Revises: 0028
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0029"
down_revision: str | None = "0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "PARAMETRE_COLLECTE" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "BL_EN_PAUSE" BOOLEAN DEFAULT false NOT NULL,
            "DT_CHANGEMENT" TIMESTAMP WITH TIME ZONE,
            "ID_UTILISATEUR" BIGINT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT pk_parametre_collecte PRIMARY KEY ("ID"),
            CONSTRAINT fk_parametre_collecte_id_utilisateur FOREIGN KEY("ID_UTILISATEUR") REFERENCES "UTILISATEUR" ("ID") ON DELETE RESTRICT
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX uq_parametre_collecte_ligne_unique ON \"PARAMETRE_COLLECTE\" ((true))")
    op.execute("CREATE INDEX idx_parametre_collecte_utilisateur ON \"PARAMETRE_COLLECTE\" (\"ID_UTILISATEUR\")")
    op.execute("CREATE TRIGGER trg_parametre_collecte_updated_at BEFORE UPDATE ON \"PARAMETRE_COLLECTE\" FOR EACH ROW EXECUTE FUNCTION set_updated_at()")
    op.execute("COMMENT ON TABLE \"PARAMETRE_COLLECTE\" IS 'État de la collecte, une seule ligne : la pause décidée par le Superviseur survit au redémarrage de l''API.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_COLLECTE\".\"ID\" IS 'Identifiant technique de la ligne de paramètres.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_COLLECTE\".\"BL_EN_PAUSE\" IS 'Indique si la collecte est en pause ; les cycles sont alors enregistrés comme ignorés.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_COLLECTE\".\"DT_CHANGEMENT\" IS 'Date de la dernière mise en pause ou reprise ; NULL si jamais changée.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_COLLECTE\".\"ID_UTILISATEUR\" IS 'Superviseur qui a mis en pause ou repris la collecte ; NULL si jamais changée.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_COLLECTE\".created_at IS 'Date de création de la ligne.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_COLLECTE\".updated_at IS 'Date de dernière modification de la ligne.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_COLLECTE\".deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"PARAMETRE_COLLECTE\"")
