from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    false,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.models import Base, TimestampMixin, primary_key, table_args
from models.reference import CollectionProfile, CollectionStatus
from models.user import User


def _state_count(column: str, comment: str) -> Mapped[int]:
    return mapped_column(
        column, Integer, nullable=False, default=0, server_default=text("0"), comment=comment
    )


class CollectionRun(TimestampMixin, Base):
    """One OpenSky collection cycle, written by the collector."""

    __tablename__ = "EXECUTION_COLLECTE"
    __table_args__ = table_args(
        CheckConstraint('"DT_FIN" IS NULL OR "DT_FIN" >= "DT_DEBUT"', name="dates_ordered"),
        CheckConstraint(
            '"NB_ETATS_RECUS" >= 0 AND "NB_ETATS_STOCKES" >= 0 AND "NB_ETATS_REJETES" >= 0',
            name="counts_not_negative",
        ),
        # A B-tree index is read in both directions, so it also serves "newest first".
        Index("idx_execution_collecte_debut", "DT_DEBUT"),
        # Also indexes the foreign key: ID_STATUT_COLLECTE comes first.
        Index("idx_execution_collecte_statut_debut", "ID_STATUT_COLLECTE", "DT_DEBUT"),
        Index("idx_execution_collecte_profil", "ID_PROFIL_COLLECTE"),
        comment=(
            "Cycle de collecte OpenSky, une ligne par cycle créée par le collecteur ; "
            "figée une fois DT_FIN renseignée."
        ),
    )

    id: Mapped[int] = primary_key("Identifiant technique du cycle de collecte.")
    started_at: Mapped[datetime] = mapped_column(
        "DT_DEBUT",
        DateTime(timezone=True),
        nullable=False,
        comment=(
            "Début du cycle ; c'est aussi l'instant transmis au moteur de règles pour l'évaluation."
        ),
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        "DT_FIN",
        DateTime(timezone=True),
        comment="Fin du cycle ; NULL tant que le cycle est en cours.",
    )
    status_id: Mapped[int] = mapped_column(
        "ID_STATUT_COLLECTE",
        BigInteger,
        ForeignKey("R_STATUT_COLLECTE.ID", ondelete="RESTRICT"),
        nullable=False,
        comment="Statut du cycle de collecte.",
    )
    profile_id: Mapped[int] = mapped_column(
        "ID_PROFIL_COLLECTE",
        BigInteger,
        ForeignKey("R_PROFIL_COLLECTE.ID", ondelete="RESTRICT"),
        nullable=False,
        comment="Profil de collecte utilisé pendant le cycle.",
    )
    states_received: Mapped[int] = _state_count(
        "NB_ETATS_RECUS", "Nombre de vecteurs d'état reçus d'OpenSky."
    )
    states_stored: Mapped[int] = _state_count(
        "NB_ETATS_STOCKES", "Nombre de vecteurs d'état enregistrés comme observations."
    )
    states_rejected: Mapped[int] = _state_count(
        "NB_ETATS_REJETES",
        "Nombre de vecteurs d'état rejetés par le nettoyage ou la validation.",
    )
    remaining_credits: Mapped[int | None] = mapped_column(
        "NB_CREDITS_RESTANTS",
        Integer,
        comment=(
            "Crédits OpenSky restants selon l'en-tête X-Rate-Limit-Remaining ; NULL si absent."
        ),
    )
    error: Mapped[str | None] = mapped_column(
        "LB_ERREUR", Text, comment="Erreur de la collecte ; NULL si aucune."
    )
    evaluation_error: Mapped[str | None] = mapped_column(
        "LB_ERREUR_EVALUATION",
        Text,
        comment=(
            "Erreur levée par le moteur de règles après la collecte, qui reste valide ; "
            "NULL si aucune."
        ),
    )

    status: Mapped[CollectionStatus] = relationship(lazy="raise")
    profile: Mapped[CollectionProfile] = relationship(lazy="raise")


class CollectionParameter(TimestampMixin, Base):
    """The single row holding the collection state, so a pause survives a restart."""

    __tablename__ = "PARAMETRE_COLLECTE"
    __table_args__ = table_args(
        # A unique index on a constant: any second row is rejected.
        Index("uq_parametre_collecte_ligne_unique", text("(true)"), unique=True),
        Index("idx_parametre_collecte_utilisateur", "ID_UTILISATEUR"),
        comment=(
            "État de la collecte, une seule ligne : la pause décidée par le Superviseur "
            "survit au redémarrage de l'API."
        ),
    )

    id: Mapped[int] = primary_key("Identifiant technique de la ligne de paramètres.")
    is_paused: Mapped[bool] = mapped_column(
        "BL_EN_PAUSE",
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
        comment=(
            "Indique si la collecte est en pause ; les cycles sont alors enregistrés comme ignorés."
        ),
    )
    changed_at: Mapped[datetime | None] = mapped_column(
        "DT_CHANGEMENT",
        DateTime(timezone=True),
        comment="Date de la dernière mise en pause ou reprise ; NULL si jamais changée.",
    )
    changed_by_id: Mapped[int | None] = mapped_column(
        "ID_UTILISATEUR",
        BigInteger,
        ForeignKey("UTILISATEUR.ID", ondelete="RESTRICT"),
        comment=("Superviseur qui a mis en pause ou repris la collecte ; NULL si jamais changée."),
    )

    changed_by: Mapped[User | None] = relationship(lazy="raise")
