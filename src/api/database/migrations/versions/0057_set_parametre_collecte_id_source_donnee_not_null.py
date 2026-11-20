"""Make PARAMETRE_COLLECTE.ID_SOURCE_DONNEE mandatory.

The table holds a single row: the scan of SET NOT NULL is instant.

Revision ID: 0057
Revises: 0056
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0057"
down_revision: str | None = "0056"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute('ALTER TABLE "PARAMETRE_COLLECTE" ALTER COLUMN "ID_SOURCE_DONNEE" SET NOT NULL')


def downgrade() -> None:
    op.execute('ALTER TABLE "PARAMETRE_COLLECTE" ALTER COLUMN "ID_SOURCE_DONNEE" DROP NOT NULL')
