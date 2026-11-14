"""Add UTILISATEUR.BL_MOT_DE_PASSE_PROVISOIRE: the password was given by a Supervisor.

An account created by a Supervisor starts with a generated password that the Supervisor
reads out. The flag forces its owner to choose their own at the first login: until then the
API refuses every route but the password change. Every existing account chose its own
password, so the column defaults to false. A constant default is a catalogue change in
PostgreSQL 11 and later: no row is rewritten and the lock is brief.

Revision ID: 0047
Revises: 0046
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0047"
down_revision: str | None = "0046"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        'ALTER TABLE "UTILISATEUR" ADD COLUMN "BL_MOT_DE_PASSE_PROVISOIRE" BOOLEAN NOT NULL DEFAULT false'
    )
    op.execute(
        'COMMENT ON COLUMN "UTILISATEUR"."BL_MOT_DE_PASSE_PROVISOIRE" IS '
        "'Indique que le mot de passe a été généré par un superviseur à la création du compte ; "
        "le titulaire doit en choisir un autre à sa première connexion.'"
    )


def downgrade() -> None:
    op.execute('ALTER TABLE "UTILISATEUR" DROP COLUMN "BL_MOT_DE_PASSE_PROVISOIRE"')
