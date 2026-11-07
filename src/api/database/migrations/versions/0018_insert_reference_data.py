"""Insert the reference data: roles, criticalities, units and audit actions.

Revision ID: 0018
Revises: 0017
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO "R_ROLE" ("CD_ROLE", "LB_ROLE") VALUES
            ('USER', 'Utilisateur'),
            ('SUPERVISOR', 'Superviseur')
        """
    )
    op.execute(
        """
        INSERT INTO "R_CRITICITE" ("CD_CRITICITE", "LB_CRITICITE") VALUES
            ('LOW', 'Basse'),
            ('MEDIUM', 'Moyenne'),
            ('HIGH', 'Haute')
        """
    )
    op.execute(
        """
        INSERT INTO "R_UNITE" ("CD_UNITE", "LB_UNITE") VALUES
            ('s', 'seconde'),
            ('m/s', 'mètre par seconde'),
            ('m/s²', 'mètre par seconde carrée'),
            ('°/s', 'degré par seconde')
        """
    )
    op.execute(
        """
        INSERT INTO audit_actions (code, label) VALUES
            ('create', 'Création'),
            ('update', 'Modification'),
            ('delete', 'Suppression')
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM audit_actions WHERE code IN ('create', 'update', 'delete')")
    op.execute("DELETE FROM \"R_UNITE\" WHERE \"CD_UNITE\" IN ('s', 'm/s', 'm/s²', '°/s')")
    op.execute("DELETE FROM \"R_CRITICITE\" WHERE \"CD_CRITICITE\" IN ('LOW', 'MEDIUM', 'HIGH')")
    op.execute("DELETE FROM \"R_ROLE\" WHERE \"CD_ROLE\" IN ('USER', 'SUPERVISOR')")
