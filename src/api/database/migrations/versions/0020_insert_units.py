"""Insert the units of the rule thresholds.

Revision ID: 0020
Revises: 0019
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO "R_UNITE" ("CD_UNITE", "LB_UNITE") VALUES
            ('s', 'seconde'),
            ('m/s', 'mètre par seconde'),
            ('m/s²', 'mètre par seconde carrée'),
            ('°/s', 'degré par seconde')
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM \"R_UNITE\" WHERE \"CD_UNITE\" IN ('s', 'm/s', 'm/s²', '°/s')")
