from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.models import (
    ULID_PATTERN,
    Base,
    PublicIdMixin,
    TimestampMixin,
    primary_key,
    table_args,
)
from models.aircraft import Aircraft
from models.reference import Criticality
from models.rule import Rule


class Alert(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "ALERTE"
    __table_args__ = table_args(
        CheckConstraint(f"\"CD_ULID\" ~ '{ULID_PATTERN}'", name="ulid_format"),
        # A processed alert always records who processed it, and only then.
        CheckConstraint(
            '("DT_TRAITEMENT" IS NULL) = ("ID_UTILISATEUR" IS NULL)',
            name="processing_complete",
        ),
        CheckConstraint(
            '"DT_FIN_EPISODE" IS NULL OR "DT_FIN_EPISODE" >= "DT_DECLENCHEMENT"',
            name="episode_ordered",
        ),
        Index("idx_alerte_aeronef", "ID_AERONEF"),
        Index("idx_alerte_regle", "ID_REGLE"),
        Index("idx_alerte_criticite", "ID_CRITICITE"),
        Index("idx_alerte_utilisateur", "ID_UTILISATEUR"),
        Index("idx_alerte_declenchement", "DT_DECLENCHEMENT"),
        # One open episode per aircraft and rule, also after a restart of the engine.
        Index(
            "uq_alerte_episode_ouvert",
            "ID_AERONEF",
            "ID_REGLE",
            unique=True,
            postgresql_where=text('"DT_FIN_EPISODE" IS NULL AND deleted_at IS NULL'),
        ),
        comment="Alerte générée par le moteur quand une règle se déclenche pour un aéronef.",
    )

    id: Mapped[int] = primary_key("Identifiant technique de l'alerte.")
    aircraft_id: Mapped[int] = mapped_column(
        "ID_AERONEF",
        BigInteger,
        ForeignKey("AERONEF.ID", ondelete="RESTRICT"),
        nullable=False,
        comment="Aéronef concerné.",
    )
    rule_id: Mapped[int] = mapped_column(
        "ID_REGLE",
        BigInteger,
        ForeignKey("REGLE.ID", ondelete="RESTRICT"),
        nullable=False,
        comment="Règle déclenchée.",
    )
    triggered_at: Mapped[datetime] = mapped_column(
        "DT_DECLENCHEMENT",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Date et heure du déclenchement.",
    )
    episode_ended_at: Mapped[datetime | None] = mapped_column(
        "DT_FIN_EPISODE",
        DateTime(timezone=True),
        comment=(
            "Date de fin de la situation ; NULL tant qu'elle dure, "
            "ce qui empêche une nouvelle alerte de la même règle pour cet aéronef."
        ),
    )
    observed_value: Mapped[Decimal | None] = mapped_column(
        "NB_VALEUR_OBSERVEE",
        Numeric(12, 3),
        comment="Valeur mesurée qui a dépassé le seuil, dans l'unité de la règle.",
    )
    threshold: Mapped[Decimal | None] = mapped_column(
        "NB_SEUIL",
        Numeric(10, 3),
        comment="Seuil en vigueur au déclenchement, recopié pour que l'alerte reste explicable.",
    )
    message: Mapped[str] = mapped_column(
        "LB_MESSAGE", Text, nullable=False, comment="Message explicatif de l'alerte."
    )
    criticality_id: Mapped[int | None] = mapped_column(
        "ID_CRITICITE",
        BigInteger,
        ForeignKey("R_CRITICITE.ID", ondelete="RESTRICT"),
        comment="Criticité de l'alerte ; NULL si aucune.",
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        "DT_TRAITEMENT",
        DateTime(timezone=True),
        comment="Date à laquelle l'alerte a été marquée comme traitée ; NULL si non traitée.",
    )
    processed_by_id: Mapped[int | None] = mapped_column(
        "ID_UTILISATEUR",
        BigInteger,
        ForeignKey("UTILISATEUR.ID", ondelete="RESTRICT"),
        comment="Superviseur qui a traité l'alerte ; NULL si non traitée.",
    )

    aircraft: Mapped[Aircraft] = relationship(lazy="raise")
    rule: Mapped[Rule] = relationship(lazy="raise")
    criticality: Mapped[Criticality | None] = relationship(lazy="raise")
