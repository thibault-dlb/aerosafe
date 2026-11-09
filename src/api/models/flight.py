from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Text,
    UniqueConstraint,
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
from models.reference import Airport


class Flight(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "VOL"
    __table_args__ = table_args(
        CheckConstraint(f"\"CD_ULID\" ~ '{ULID_PATTERN}'", name="ulid_format"),
        # A flight can hold a single observation, so both dates can be equal.
        CheckConstraint('"DT_FIN" IS NULL OR "DT_FIN" >= "DT_DEBUT"', name="dates_ordered"),
        # Target of the composite foreign key from OBSERVATION.
        UniqueConstraint("ID", "ID_AERONEF"),
        Index("idx_vol_aeronef", "ID_AERONEF", "DT_DEBUT"),
        Index("idx_vol_aeronef_ouvert", "ID_AERONEF", postgresql_where=text('"DT_FIN" IS NULL')),
        Index("idx_vol_aeroport_origine", "ID_AEROPORT_ORIGINE"),
        Index("idx_vol_aeroport_destination", "ID_AEROPORT_DESTINATION"),
        comment="Vol d'un aéronef : observations successives séparées d'au plus N minutes (D-06).",
    )

    id: Mapped[int] = primary_key("Identifiant technique du vol.")
    aircraft_id: Mapped[int] = mapped_column(
        "ID_AERONEF",
        BigInteger,
        ForeignKey("AERONEF.ID", ondelete="RESTRICT"),
        nullable=False,
        comment="Aéronef qui effectue le vol.",
    )
    callsign: Mapped[str | None] = mapped_column(
        "LB_INDICATIF",
        Text,
        comment="Indicatif d'appel radio du vol (callsign OpenSky), si connu.",
    )
    started_at: Mapped[datetime] = mapped_column(
        "DT_DEBUT",
        DateTime(timezone=True),
        nullable=False,
        comment="Date et heure de la première observation du vol.",
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        "DT_FIN",
        DateTime(timezone=True),
        comment=(
            "Date et heure de la dernière observation du vol ; NULL tant que le vol est en cours."
        ),
    )
    origin_airport_id: Mapped[int | None] = mapped_column(
        "ID_AEROPORT_ORIGINE",
        BigInteger,
        ForeignKey("R_AEROPORT.ID", ondelete="RESTRICT"),
        comment="Aéroport de départ ; NULL si inconnu.",
    )
    destination_airport_id: Mapped[int | None] = mapped_column(
        "ID_AEROPORT_DESTINATION",
        BigInteger,
        ForeignKey("R_AEROPORT.ID", ondelete="RESTRICT"),
        comment="Aéroport d'arrivée ; NULL si inconnu.",
    )

    aircraft: Mapped[Aircraft] = relationship(lazy="raise")
    origin_airport: Mapped[Airport | None] = relationship(
        lazy="raise", foreign_keys=[origin_airport_id]
    )
    destination_airport: Mapped[Airport | None] = relationship(
        lazy="raise", foreign_keys=[destination_airport_id]
    )
