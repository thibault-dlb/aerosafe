"""Create the R_ROLE table.

Revision ID: 0003
Revises: 0002
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "R_ROLE" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "CD_ROLE" TEXT NOT NULL,
            "LB_ROLE" TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true NOT NULL,
            CONSTRAINT pk_r_role PRIMARY KEY ("ID"),
            CONSTRAINT uq_r_role_cd_role UNIQUE ("CD_ROLE")
        )
        """
    )
    op.execute("COMMENT ON TABLE \"R_ROLE\" IS 'Référentiel des rôles applicatifs (Utilisateur, Superviseur).'")
    op.execute("COMMENT ON COLUMN \"R_ROLE\".\"ID\" IS 'Identifiant technique du rôle.'")
    op.execute("COMMENT ON COLUMN \"R_ROLE\".\"CD_ROLE\" IS 'Code stable du rôle, utilisé par l''API pour les contrôles d''accès.'")
    op.execute("COMMENT ON COLUMN \"R_ROLE\".\"LB_ROLE\" IS 'Libellé du rôle affiché à l''écran.'")
    op.execute("COMMENT ON COLUMN \"R_ROLE\".is_active IS 'Indique si le rôle peut encore être attribué.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"R_ROLE\"")
