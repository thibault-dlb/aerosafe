from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Index, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.models import (
    ULID_PATTERN,
    Base,
    PublicIdMixin,
    TimestampMixin,
    primary_key,
    table_args,
)
from models.reference import AircraftModel, Airline, DataSource


class Aircraft(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "AERONEF"
    __table_args__ = table_args(
        CheckConstraint(f"\"CD_ULID\" ~ '{ULID_PATTERN}'", name="ulid_format"),
        CheckConstraint("\"CD_ICAO24\" ~ '^[0-9a-f]{6}$'", name="icao24_format"),
        # The address is unique for each source: the synthetic codes of a replayed dataset can
        # equal the address of a real aircraft collected live.
        UniqueConstraint("CD_ICAO24", "ID_SOURCE_DONNEE"),
        Index("idx_aeronef_modele", "ID_MODELE"),
        Index("idx_aeronef_compagnie", "ID_COMPAGNIE"),
        Index("idx_aeronef_source_donnee", "ID_SOURCE_DONNEE"),
        Index(
            "idx_aeronef_immatriculation_trgm",
            "LB_IMMATRICULATION",
            postgresql_using="gin",
            postgresql_ops={"LB_IMMATRICULATION": "gin_trgm_ops"},
        ),
        comment=(
            "Aéronef suivi, créé par le collecteur OpenSky "
            "à la première observation de son code ICAO24."
        ),
    )

    id: Mapped[int] = primary_key("Identifiant technique de l'aéronef.")
    icao24: Mapped[str] = mapped_column(
        "CD_ICAO24",
        Text,
        nullable=False,
        comment=(
            "Adresse ICAO24 du transpondeur, 6 caractères hexadécimaux en minuscules (clé métier)."
        ),
    )
    source_id: Mapped[int] = mapped_column(
        "ID_SOURCE_DONNEE",
        BigInteger,
        ForeignKey("R_SOURCE_DONNEE.ID", ondelete="RESTRICT"),
        nullable=False,
        # The key 1 is DIRECT, inserted first by the migration that creates the column.
        server_default=text("1"),
        comment=(
            "Source de l'aéronef : collecte en direct (DIRECT, par défaut) "
            "ou trafic historique rejoué (REJEU)."
        ),
    )
    registration: Mapped[str | None] = mapped_column(
        "LB_IMMATRICULATION", Text, comment="Immatriculation de l'aéronef, si connue."
    )
    model_id: Mapped[int | None] = mapped_column(
        "ID_MODELE",
        BigInteger,
        ForeignKey("R_MODELE.ID", ondelete="RESTRICT"),
        comment="Modèle de l'aéronef ; NULL si inconnu.",
    )
    airline_id: Mapped[int | None] = mapped_column(
        "ID_COMPAGNIE",
        BigInteger,
        ForeignKey("R_COMPAGNIE.ID", ondelete="RESTRICT"),
        comment="Compagnie exploitant l'aéronef ; NULL si inconnue.",
    )

    model: Mapped[AircraftModel | None] = relationship(lazy="raise")
    airline: Mapped[Airline | None] = relationship(lazy="raise")
    source: Mapped[DataSource] = relationship(lazy="raise")
