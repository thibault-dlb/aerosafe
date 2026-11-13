"""Index AERONEF.ID_SOURCE_DONNEE, a foreign key.

Revision ID: 0038
Revises: 0037
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0038"
down_revision: str | None = "0037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE INDEX idx_aeronef_source_donnee ON \"AERONEF\" (\"ID_SOURCE_DONNEE\")")


def downgrade() -> None:
    op.execute("DROP INDEX idx_aeronef_source_donnee")
