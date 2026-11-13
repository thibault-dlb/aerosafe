"""Insert the default administrator account: admin@aerosafe.com, a Supervisor.

The password is `admin`, stored as an argon2id hash made by the application's own hasher. The
account exists so that a fresh installation can be used at once (the replay, the rules and the
collection are Supervisor features). It is a published credential: change the password, or
deactivate the account, before exposing an installation.

Revision ID: 0046
Revises: 0045
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0046"
down_revision: str | None = "0045"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # An existing account with this address is left as it is.
    op.execute(
        """
        INSERT INTO "UTILISATEUR" ("CD_ULID", "LN_EMAIL", "LB_HASH_MOT_DE_PASSE", "ID_ROLE")
        SELECT '01M7A5XGSQX4ZGFQRMWY32SGJA',
               'admin@aerosafe.com',
               '$argon2id$v=19$m=65536,t=3,p=4$gD5iSSGpn8kftXGvFWLizA$9m1NRpXwTD2S/WmjWl9/M049np+F20vmGblvGgS77F0',
               "ID"
        FROM "R_ROLE"
        WHERE "CD_ROLE" = 'SUPERVISOR'
        ON CONFLICT ("LN_EMAIL") DO NOTHING
        """
    )


def downgrade() -> None:
    # The sessions of the account go with it. The statement fails, on purpose, if the account
    # already acted (an alert handled, a collection or a replay changed): that history is kept.
    op.execute(
        """
        DELETE FROM "JETON_RAFRAICHISSEMENT"
        WHERE "ID_UTILISATEUR" IN (SELECT "ID" FROM "UTILISATEUR" WHERE "LN_EMAIL" = 'admin@aerosafe.com')
        """
    )
    op.execute("DELETE FROM \"UTILISATEUR\" WHERE \"LN_EMAIL\" = 'admin@aerosafe.com'")
