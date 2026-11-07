"""Insert the criticality levels.

Revision ID: 0019
Revises: 0018
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO "R_CRITICITE" ("CD_CRITICITE", "LB_CRITICITE") VALUES
            ('LOW', 'Basse'),
            ('MEDIUM', 'Moyenne'),
            ('HIGH', 'Haute')
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM \"R_CRITICITE\" WHERE \"CD_CRITICITE\" IN ('LOW', 'MEDIUM', 'HIGH')")
