"""Create the R_CRITICITE table.

Revision ID: 0004
Revises: 0003
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "R_CRITICITE" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "CD_CRITICITE" TEXT NOT NULL,
            "LB_CRITICITE" TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true NOT NULL,
            CONSTRAINT pk_r_criticite PRIMARY KEY ("ID"),
            CONSTRAINT uq_r_criticite_cd_criticite UNIQUE ("CD_CRITICITE")
        )
        """
    )
    op.execute("COMMENT ON TABLE \"R_CRITICITE\" IS 'Référentiel des niveaux de criticité des alertes (basse, moyenne, haute).'")
    op.execute("COMMENT ON COLUMN \"R_CRITICITE\".\"ID\" IS 'Identifiant technique du niveau de criticité.'")
    op.execute("COMMENT ON COLUMN \"R_CRITICITE\".\"CD_CRITICITE\" IS 'Code stable du niveau de criticité.'")
    op.execute("COMMENT ON COLUMN \"R_CRITICITE\".\"LB_CRITICITE\" IS 'Libellé du niveau de criticité affiché à l''écran.'")
    op.execute("COMMENT ON COLUMN \"R_CRITICITE\".is_active IS 'Indique si le niveau peut encore être utilisé.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"R_CRITICITE\"")
