"""Add AERONEF.ID_SOURCE_DONNEE, nullable with a default: where the aircraft comes from.

Every existing aircraft was collected live, so the column defaults to DIRECT, the key 1 inserted
first by 0036. A constant default is a catalogue change in PostgreSQL 11 and later: no row is
rewritten and the lock is brief, so existing rows read the default at once and none is empty.
The foreign key and the NOT NULL come in the next migrations, without a long lock on the table.
The check below stops the migration if the key 1 is not the one of DIRECT.

Revision ID: 0037
Revises: 0036
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0037"
down_revision: str | None = "0036"
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
    op.execute("ALTER TABLE \"AERONEF\" ADD COLUMN \"ID_SOURCE_DONNEE\" BIGINT DEFAULT 1")
    op.execute("COMMENT ON COLUMN \"AERONEF\".\"ID_SOURCE_DONNEE\" IS 'Source de l''aéronef : collecte en direct (DIRECT, par défaut) ou trafic historique rejoué (REJEU).'")


def downgrade() -> None:
    op.execute("ALTER TABLE \"AERONEF\" DROP COLUMN \"ID_SOURCE_DONNEE\"")
