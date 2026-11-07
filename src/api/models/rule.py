from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Numeric,
    Text,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.models import Base, TimestampMixin, primary_key, table_args
from models.reference import Criticality, Unit


class Rule(TimestampMixin, Base):
    __tablename__ = "REGLE"
    __table_args__ = table_args(
        CheckConstraint('"NB_SEUIL" >= 0', name="threshold_positive"),
        Index("idx_regle_unite", "ID_UNITE"),
        Index("idx_regle_criticite", "ID_CRITICITE"),
        comment=(
            "Règle métier évaluée par le moteur ; le Superviseur peut modifier son seuil (UC-05)."
        ),
    )

    id: Mapped[int] = primary_key("Identifiant technique de la règle.")
    code: Mapped[str] = mapped_column(
        "CD_REGLE",
        Text,
        nullable=False,
        unique=True,
        comment="Code de la règle (R1, R2, ...), libre pour permettre d'en ajouter (NF-06).",
    )
    description: Mapped[str] = mapped_column(
        "LB_DESCRIPTION",
        Text,
        nullable=False,
        comment="Description de la situation inhabituelle détectée.",
    )
    threshold: Mapped[Decimal] = mapped_column(
        "NB_SEUIL",
        Numeric(10, 3),
        nullable=False,
        comment="Seuil de déclenchement, exprimé dans l'unité de la règle.",
    )
    unit_id: Mapped[int] = mapped_column(
        "ID_UNITE",
        BigInteger,
        ForeignKey("R_UNITE.ID", ondelete="RESTRICT"),
        nullable=False,
        comment="Unité du seuil.",
    )
    criticality_id: Mapped[int | None] = mapped_column(
        "ID_CRITICITE",
        BigInteger,
        ForeignKey("R_CRITICITE.ID", ondelete="RESTRICT"),
        comment="Criticité par défaut recopiée dans les alertes de la règle ; NULL si aucune.",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=true(),
        comment="Indique si la règle est évaluée par le moteur.",
    )

    unit: Mapped[Unit] = relationship(lazy="raise")
    criticality: Mapped[Criticality | None] = relationship(lazy="raise")
