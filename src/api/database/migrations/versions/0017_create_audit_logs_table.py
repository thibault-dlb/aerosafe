"""Create the audit_logs table.

Revision ID: 0017
Revises: 0016
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE audit_logs (
            id BIGINT GENERATED ALWAYS AS IDENTITY,
            table_name TEXT NOT NULL,
            record_id BIGINT NOT NULL,
            action_id BIGINT NOT NULL,
            old_values JSONB,
            new_values JSONB,
            user_id BIGINT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            CONSTRAINT pk_audit_logs PRIMARY KEY (id),
            CONSTRAINT fk_audit_logs_action_id FOREIGN KEY(action_id) REFERENCES audit_actions (id) ON DELETE RESTRICT,
            CONSTRAINT fk_audit_logs_user_id FOREIGN KEY(user_id) REFERENCES "UTILISATEUR" ("ID") ON DELETE RESTRICT
        )
        """
    )
    op.execute("CREATE INDEX idx_audit_action ON audit_logs (action_id)")
    op.execute("CREATE INDEX idx_audit_table_record ON audit_logs (table_name, record_id)")
    op.execute("CREATE INDEX idx_audit_user ON audit_logs (user_id)")
    op.execute("CREATE TRIGGER trg_audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_audit_change()")
    op.execute("CREATE TRIGGER trg_audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_change()")
    op.execute("COMMENT ON TABLE audit_logs IS 'Journal d''audit en ajout seul : changements de seuil et anonymisations.'")
    op.execute("COMMENT ON COLUMN audit_logs.id IS 'Identifiant technique de l''événement.'")
    op.execute("COMMENT ON COLUMN audit_logs.table_name IS 'Nom de la table concernée.'")
    op.execute("COMMENT ON COLUMN audit_logs.record_id IS 'Identifiant de la ligne concernée.'")
    op.execute("COMMENT ON COLUMN audit_logs.action_id IS 'Action effectuée.'")
    op.execute("COMMENT ON COLUMN audit_logs.old_values IS 'Valeurs avant le changement ; NULL pour une création.'")
    op.execute("COMMENT ON COLUMN audit_logs.new_values IS 'Valeurs après le changement ; NULL pour une suppression.'")
    op.execute("COMMENT ON COLUMN audit_logs.user_id IS 'Utilisateur à l''origine de l''action ; NULL pour une action du système.'")
    op.execute("COMMENT ON COLUMN audit_logs.created_at IS 'Date de l''événement.'")


def downgrade() -> None:
    op.execute("DROP TABLE audit_logs")
