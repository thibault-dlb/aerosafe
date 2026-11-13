from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    text,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.models import Base, TimestampMixin, primary_key, table_args
from models.user import User


class ReplayParameter(TimestampMixin, Base):
    """The single row holding the replay clock, shared by every user."""

    __tablename__ = "PARAMETRE_REJEU"
    __table_args__ = table_args(
        CheckConstraint('"NB_VITESSE" > 0', name="speed_positive"),
        # A unique index on a constant: any second row is rejected.
        Index("uq_parametre_rejeu_ligne_unique", text("(true)"), unique=True),
        Index("idx_parametre_rejeu_utilisateur", "ID_UTILISATEUR"),
        comment=(
            "État de l'horloge de rejeu du trafic historique, une seule ligne : il survit "
            "au redémarrage de l'API et il est commun à tous les utilisateurs."
        ),
    )

    id: Mapped[int] = primary_key("Identifiant technique de la ligne de paramètres.")
    simulated_at: Mapped[datetime | None] = mapped_column(
        "DT_INSTANT_SIMULE",
        DateTime(timezone=True),
        comment=(
            "Instant simulé au moment du dernier changement (démarrage, pause, reprise) ; "
            "NULL tant qu'aucun rejeu n'a démarré."
        ),
    )
    changed_at: Mapped[datetime | None] = mapped_column(
        "DT_CHANGEMENT",
        DateTime(timezone=True),
        comment=(
            "Instant réel du dernier changement ; l'instant simulé courant s'en déduit "
            "avec la vitesse ; NULL si jamais changé."
        ),
    )
    speed: Mapped[int] = mapped_column(
        "NB_VITESSE",
        Integer,
        nullable=False,
        default=1,
        server_default=text("1"),
        comment="Vitesse du rejeu : nombre de secondes simulées pour une seconde réelle.",
    )
    is_paused: Mapped[bool] = mapped_column(
        "BL_EN_PAUSE",
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
        comment="Indique si le rejeu est en pause ; il l'est tant qu'aucun rejeu n'a démarré.",
    )
    evaluated_until: Mapped[datetime | None] = mapped_column(
        "DT_DERNIERE_EVALUATION",
        DateTime(timezone=True),
        comment=(
            "Dernier instant simulé évalué par le moteur de règles ; NULL si aucune évaluation."
        ),
    )
    changed_by_id: Mapped[int | None] = mapped_column(
        "ID_UTILISATEUR",
        BigInteger,
        ForeignKey("UTILISATEUR.ID", ondelete="RESTRICT"),
        comment="Superviseur qui a fait le dernier changement ; NULL si jamais changé.",
    )

    changed_by: Mapped[User | None] = relationship(lazy="raise")
