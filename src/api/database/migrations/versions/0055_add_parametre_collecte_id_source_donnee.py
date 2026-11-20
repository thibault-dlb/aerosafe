"""Add PARAMETRE_COLLECTE.ID_SOURCE_DONNEE, with a default: the collection the row describes.

Each live source gets its own pause. The single existing row is the OpenSky one, so the column
defaults to DIRECT, the key 1 (checked by 0050). The table holds one row: the foreign key and
the NOT NULL that follow lock it for no time.

Revision ID: 0055
Revises: 0054
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0055"
down_revision: str | None = "0054"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute('ALTER TABLE "PARAMETRE_COLLECTE" ADD COLUMN "ID_SOURCE_DONNEE" BIGINT DEFAULT 1')
    op.execute(
        'COMMENT ON COLUMN "PARAMETRE_COLLECTE"."ID_SOURCE_DONNEE" IS '
        "'Collecte décrite par la ligne : OpenSky (DIRECT, par défaut) ou adsb.fi (ADSBFI).'"
    )


def downgrade() -> None:
    op.execute('ALTER TABLE "PARAMETRE_COLLECTE" DROP COLUMN "ID_SOURCE_DONNEE"')
