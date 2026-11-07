"""Insert the application roles.

Revision ID: 0018
Revises: 0017
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO "R_ROLE" ("CD_ROLE", "LB_ROLE") VALUES
            ('USER', 'Utilisateur'),
            ('SUPERVISOR', 'Superviseur')
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM \"R_ROLE\" WHERE \"CD_ROLE\" IN ('USER', 'SUPERVISOR')")
