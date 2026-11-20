"""Add the foreign key of PARAMETRE_COLLECTE.ID_SOURCE_DONNEE.

The table holds a single row, so the key is validated at once.

Revision ID: 0056
Revises: 0055
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0056"
down_revision: str | None = "0055"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE \"PARAMETRE_COLLECTE\" ADD CONSTRAINT fk_parametre_collecte_id_source_donnee "
        "FOREIGN KEY (\"ID_SOURCE_DONNEE\") REFERENCES \"R_SOURCE_DONNEE\" (\"ID\") "
        "ON DELETE RESTRICT"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE \"PARAMETRE_COLLECTE\" DROP CONSTRAINT fk_parametre_collecte_id_source_donnee"
    )
