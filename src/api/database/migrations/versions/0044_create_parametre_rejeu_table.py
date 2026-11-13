"""Create the PARAMETRE_REJEU table.

The table holds a single row, like PARAMETRE_COLLECTE: the replay clock is shared by every user,
and its state survives a restart of the API.

Revision ID: 0044
Revises: 0043
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0044"
down_revision: str | None = "0043"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "PARAMETRE_REJEU" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "DT_INSTANT_SIMULE" TIMESTAMP WITH TIME ZONE,
            "DT_CHANGEMENT" TIMESTAMP WITH TIME ZONE,
            "NB_VITESSE" INTEGER DEFAULT 1 NOT NULL,
            "BL_EN_PAUSE" BOOLEAN DEFAULT true NOT NULL,
            "DT_DERNIERE_EVALUATION" TIMESTAMP WITH TIME ZONE,
            "ID_UTILISATEUR" BIGINT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT pk_parametre_rejeu PRIMARY KEY ("ID"),
            CONSTRAINT ck_parametre_rejeu_speed_positive CHECK ("NB_VITESSE" > 0),
            CONSTRAINT fk_parametre_rejeu_id_utilisateur FOREIGN KEY("ID_UTILISATEUR") REFERENCES "UTILISATEUR" ("ID") ON DELETE RESTRICT
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX uq_parametre_rejeu_ligne_unique ON \"PARAMETRE_REJEU\" ((true))")
    op.execute("CREATE INDEX idx_parametre_rejeu_utilisateur ON \"PARAMETRE_REJEU\" (\"ID_UTILISATEUR\")")
    op.execute("CREATE TRIGGER trg_parametre_rejeu_updated_at BEFORE UPDATE ON \"PARAMETRE_REJEU\" FOR EACH ROW EXECUTE FUNCTION set_updated_at()")
    op.execute("COMMENT ON TABLE \"PARAMETRE_REJEU\" IS 'État de l''horloge de rejeu du trafic historique, une seule ligne : il survit au redémarrage de l''API et il est commun à tous les utilisateurs.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_REJEU\".\"ID\" IS 'Identifiant technique de la ligne de paramètres.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_REJEU\".\"DT_INSTANT_SIMULE\" IS 'Instant simulé au moment du dernier changement (démarrage, pause, reprise) ; NULL tant qu''aucun rejeu n''a démarré.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_REJEU\".\"DT_CHANGEMENT\" IS 'Instant réel du dernier changement ; l''instant simulé courant s''en déduit avec la vitesse ; NULL si jamais changé.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_REJEU\".\"NB_VITESSE\" IS 'Vitesse du rejeu : nombre de secondes simulées pour une seconde réelle.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_REJEU\".\"BL_EN_PAUSE\" IS 'Indique si le rejeu est en pause ; il l''est tant qu''aucun rejeu n''a démarré.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_REJEU\".\"DT_DERNIERE_EVALUATION\" IS 'Dernier instant simulé évalué par le moteur de règles ; NULL si aucune évaluation.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_REJEU\".\"ID_UTILISATEUR\" IS 'Superviseur qui a fait le dernier changement ; NULL si jamais changé.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_REJEU\".created_at IS 'Date de création de la ligne.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_REJEU\".updated_at IS 'Date de dernière modification de la ligne.'")
    op.execute("COMMENT ON COLUMN \"PARAMETRE_REJEU\".deleted_at IS 'Date de suppression logique ; NULL si la ligne est active.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"PARAMETRE_REJEU\"")
