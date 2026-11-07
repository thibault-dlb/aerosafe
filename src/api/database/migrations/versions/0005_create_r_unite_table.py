"""Create the R_UNITE table.

Revision ID: 0005
Revises: 0004
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE "R_UNITE" (
            "ID" BIGINT GENERATED ALWAYS AS IDENTITY,
            "CD_UNITE" TEXT NOT NULL,
            "LB_UNITE" TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true NOT NULL,
            CONSTRAINT pk_r_unite PRIMARY KEY ("ID"),
            CONSTRAINT uq_r_unite_cd_unite UNIQUE ("CD_UNITE")
        )
        """
    )
    op.execute("COMMENT ON TABLE \"R_UNITE\" IS 'Référentiel des unités dans lesquelles sont exprimés les seuils des règles.'")
    op.execute("COMMENT ON COLUMN \"R_UNITE\".\"ID\" IS 'Identifiant technique de l''unité.'")
    op.execute("COMMENT ON COLUMN \"R_UNITE\".\"CD_UNITE\" IS 'Symbole de l''unité (s, m/s, m/s², °/s).'")
    op.execute("COMMENT ON COLUMN \"R_UNITE\".\"LB_UNITE\" IS 'Libellé complet de l''unité.'")
    op.execute("COMMENT ON COLUMN \"R_UNITE\".is_active IS 'Indique si l''unité peut encore être utilisée.'")


def downgrade() -> None:
    op.execute("DROP TABLE \"R_UNITE\"")
