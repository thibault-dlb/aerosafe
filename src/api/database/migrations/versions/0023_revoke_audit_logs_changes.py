"""Remove the rights to change audit_logs from the application user.

The application user gets UPDATE and DELETE on every table through the default privileges of
docker/init-db.sh. The triggers of audit_logs reject them too, but a right that must never be
used should not exist. The name comes from the settings, quoted by the database dialect.

Revision ID: 0023
Revises: 0022
"""

from collections.abc import Sequence

from alembic import op

from config.database import settings

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _application_user() -> str:
    return op.get_bind().dialect.identifier_preparer.quote_identifier(settings.DB_USER)


def upgrade() -> None:
    op.execute(f"REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM {_application_user()}")


def downgrade() -> None:
    op.execute(f"GRANT UPDATE, DELETE ON audit_logs TO {_application_user()}")
