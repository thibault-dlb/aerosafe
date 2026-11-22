"""Make EXECUTION_COLLECTE.ID_SOURCE_DONNEE mandatory.

As in 0040: a validated CHECK lets SET NOT NULL skip the scan of the table, then it is dropped.

Revision ID: 0053
Revises: 0052
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0053"
down_revision: str | None = "0052"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE \"EXECUTION_COLLECTE\" ADD CONSTRAINT ck_execution_collecte_source_renseignee "
        "CHECK (\"ID_SOURCE_DONNEE\" IS NOT NULL) NOT VALID"
    )
    op.execute(
        "ALTER TABLE \"EXECUTION_COLLECTE\" "
        "VALIDATE CONSTRAINT ck_execution_collecte_source_renseignee"
    )
    op.execute('ALTER TABLE "EXECUTION_COLLECTE" ALTER COLUMN "ID_SOURCE_DONNEE" SET NOT NULL')
    op.execute(
        "ALTER TABLE \"EXECUTION_COLLECTE\" DROP CONSTRAINT ck_execution_collecte_source_renseignee"
    )


def downgrade() -> None:
    op.execute('ALTER TABLE "EXECUTION_COLLECTE" ALTER COLUMN "ID_SOURCE_DONNEE" DROP NOT NULL')
