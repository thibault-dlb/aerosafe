"""Add EXECUTION_COLLECTE.ID_SOURCE_DONNEE, nullable with a default: the source of the cycle.

Every existing cycle collected OpenSky, so the column defaults to DIRECT, the key 1 inserted
first by 0036 (checked below, as in 0037). A constant default is a catalogue change in
PostgreSQL 11 and later: no row is rewritten and the lock is brief. The foreign key and the
NOT NULL come in the next migrations.

Revision ID: 0050
Revises: 0049
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0050"
down_revision: str | None = "0049"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF (SELECT "ID" FROM "R_SOURCE_DONNEE" WHERE "CD_SOURCE_DONNEE" = 'DIRECT') <> 1 THEN
                RAISE EXCEPTION 'The source DIRECT must have the key 1';
            END IF;
        END
        $$
        """
    )
    op.execute('ALTER TABLE "EXECUTION_COLLECTE" ADD COLUMN "ID_SOURCE_DONNEE" BIGINT DEFAULT 1')
    op.execute(
        'COMMENT ON COLUMN "EXECUTION_COLLECTE"."ID_SOURCE_DONNEE" IS '
        "'Source collectée pendant le cycle : OpenSky (DIRECT, par défaut) ou adsb.fi (ADSBFI).'"
    )


def downgrade() -> None:
    op.execute('ALTER TABLE "EXECUTION_COLLECTE" DROP COLUMN "ID_SOURCE_DONNEE"')
