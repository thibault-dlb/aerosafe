from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Text, func, true
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from core.models import Base, primary_key, table_args


class AuditAction(Base):
    """Technical table: English names (D-15)."""

    __tablename__ = "audit_actions"
    __table_args__ = table_args(
        comment="Référentiel des actions tracées dans le journal d'audit."
    )

    id: Mapped[int] = primary_key("Identifiant technique de l'action.", name="id")
    code: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
        comment="Code stable de l'action (create, update, delete).",
    )
    label: Mapped[str] = mapped_column(Text, nullable=False, comment="Libellé de l'action.")
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=true(),
        comment="Indique si l'action peut encore être utilisée.",
    )


class AuditLog(Base):
    """Append-only: database triggers reject UPDATE, DELETE and TRUNCATE."""

    __tablename__ = "audit_logs"
    __table_args__ = table_args(
        Index("idx_audit_table_record", "table_name", "record_id"),
        Index("idx_audit_action", "action_id"),
        Index("idx_audit_user", "user_id"),
        comment="Journal d'audit en ajout seul : changements de seuil et anonymisations.",
    )

    id: Mapped[int] = primary_key("Identifiant technique de l'événement.", name="id")
    table_name: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Nom de la table concernée."
    )
    record_id: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="Identifiant de la ligne concernée."
    )
    action_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("audit_actions.id", ondelete="RESTRICT"),
        nullable=False,
        comment="Action effectuée.",
    )
    old_values: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, comment="Valeurs avant le changement ; NULL pour une création."
    )
    new_values: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, comment="Valeurs après le changement ; NULL pour une suppression."
    )
    user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("UTILISATEUR.ID", ondelete="RESTRICT"),
        comment="Utilisateur à l'origine de l'action ; NULL pour une action du système.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Date de l'événement.",
    )
