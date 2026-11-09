from datetime import datetime
from decimal import Decimal

from geoalchemy2 import Geometry, WKBElement
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from core.models import Base, TimestampMixin, primary_key, table_args


class Observation(TimestampMixin, Base):
    """One point per row, a deliberate deviation from conventions §15: see docs/data-model.md."""

    __tablename__ = "OBSERVATION"
    __table_args__ = table_args(
        # The same OpenSky state vector is never stored twice.
        UniqueConstraint("ID_AERONEF", "DT_DERNIER_CONTACT"),
        # A flight always belongs to the aircraft of its observations.
        ForeignKeyConstraint(
            ["ID_VOL", "ID_AERONEF"], ["VOL.ID", "VOL.ID_AERONEF"], ondelete="RESTRICT"
        ),
        CheckConstraint(
            '"DT_POSITION" IS NULL OR "DT_POSITION" <= "DT_DERNIER_CONTACT"',
            name="position_before_contact",
        ),
        CheckConstraint('"NB_VITESSE" >= 0', name="speed_positive"),
        CheckConstraint('"NB_CAP" >= 0 AND "NB_CAP" < 360', name="heading_range"),
        Index("idx_observation_vol", "ID_VOL", "DT_POSITION"),
        Index("idx_observation_vol_contact", "ID_VOL", "DT_DERNIER_CONTACT"),
        Index("idx_observation_contact", "DT_DERNIER_CONTACT"),
        Index("idx_observation_position", "GEO_POSITION", postgresql_using="gist"),
        comment=(
            "Vecteur d'état d'un aéronef reçu d'OpenSky, nettoyé puis stocké par le collecteur."
        ),
    )

    id: Mapped[int] = primary_key("Identifiant technique de l'observation.")
    aircraft_id: Mapped[int] = mapped_column(
        "ID_AERONEF",
        BigInteger,
        ForeignKey("AERONEF.ID", ondelete="RESTRICT"),
        nullable=False,
        comment="Aéronef observé.",
    )
    flight_id: Mapped[int | None] = mapped_column(
        "ID_VOL",
        BigInteger,
        comment=(
            "Vol auquel l'observation est rattachée, forcément du même aéronef ; "
            "NULL si elle n'appartient à aucun vol."
        ),
    )
    last_contact_at: Mapped[datetime] = mapped_column(
        "DT_DERNIER_CONTACT",
        DateTime(timezone=True),
        nullable=False,
        comment=(
            "Date du dernier message reçu de l'aéronef (last_contact OpenSky), utilisée par R1."
        ),
    )
    position_at: Mapped[datetime | None] = mapped_column(
        "DT_POSITION",
        DateTime(timezone=True),
        comment=(
            "Date de la dernière position connue (time_position OpenSky), "
            "utilisée par R2 ; NULL sans position."
        ),
    )
    position: Mapped[WKBElement | None] = mapped_column(
        "GEO_POSITION",
        Geometry(geometry_type="POINT", srid=4326, spatial_index=False),
        comment="Position géographique (point PostGIS, WGS 84) ; NULL sans position.",
    )
    altitude: Mapped[Decimal | None] = mapped_column(
        "NB_ALTITUDE", Numeric(7, 1), comment="Altitude en mètres."
    )
    speed: Mapped[Decimal | None] = mapped_column(
        "NB_VITESSE", Numeric(6, 2), comment="Vitesse sol en mètres par seconde."
    )
    heading: Mapped[Decimal | None] = mapped_column(
        "NB_CAP", Numeric(5, 2), comment="Cap vrai en degrés, de 0 inclus à 360 exclu."
    )
    on_ground: Mapped[bool] = mapped_column(
        "BL_AU_SOL",
        Boolean,
        nullable=False,
        comment=(
            "Vrai si l'aéronef est au sol (on_ground OpenSky) ; "
            "les règles ne portent que sur les aéronefs en vol."
        ),
    )
