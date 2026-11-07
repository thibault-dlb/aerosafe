"""Create the audit_actions table.

Revision ID: 0016
Revises: 0015
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE audit_actions (
            id BIGINT GENERATED ALWAYS AS IDENTITY,
            code TEXT NOT NULL,
            label TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true NOT NULL,
            CONSTRAINT pk_audit_actions PRIMARY KEY (id),
            CONSTRAINT uq_audit_actions_code UNIQUE (code)
        )
        """
    )
    op.execute("COMMENT ON TABLE audit_actions IS 'Référentiel des actions tracées dans le journal d''audit.'")
    op.execute("COMMENT ON COLUMN audit_actions.id IS 'Identifiant technique de l''action.'")
    op.execute("COMMENT ON COLUMN audit_actions.code IS 'Code stable de l''action (create, update, delete).'")
    op.execute("COMMENT ON COLUMN audit_actions.label IS 'Libellé de l''action.'")
    op.execute("COMMENT ON COLUMN audit_actions.is_active IS 'Indique si l''action peut encore être utilisée.'")


def downgrade() -> None:
    op.execute("DROP TABLE audit_actions")
