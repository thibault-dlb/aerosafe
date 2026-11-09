from sqlalchemy import Boolean, Index, Text, true
from sqlalchemy.orm import Mapped, mapped_column

from core.models import Base, primary_key, table_args


def _is_active(comment: str) -> Mapped[bool]:
    return mapped_column(Boolean, nullable=False, server_default=true(), comment=comment)


class Role(Base):
    __tablename__ = "R_ROLE"
    __table_args__ = table_args(
        comment="Référentiel des rôles applicatifs (Utilisateur, Superviseur)."
    )

    id: Mapped[int] = primary_key("Identifiant technique du rôle.")
    code: Mapped[str] = mapped_column(
        "CD_ROLE",
        Text,
        nullable=False,
        unique=True,
        comment="Code stable du rôle, utilisé par l'API pour les contrôles d'accès.",
    )
    label: Mapped[str] = mapped_column(
        "LB_ROLE", Text, nullable=False, comment="Libellé du rôle affiché à l'écran."
    )
    is_active: Mapped[bool] = _is_active("Indique si le rôle peut encore être attribué.")


class Criticality(Base):
    __tablename__ = "R_CRITICITE"
    __table_args__ = table_args(
        comment="Référentiel des niveaux de criticité des alertes (basse, moyenne, haute)."
    )

    id: Mapped[int] = primary_key("Identifiant technique du niveau de criticité.")
    code: Mapped[str] = mapped_column(
        "CD_CRITICITE",
        Text,
        nullable=False,
        unique=True,
        comment="Code stable du niveau de criticité.",
    )
    label: Mapped[str] = mapped_column(
        "LB_CRITICITE",
        Text,
        nullable=False,
        comment="Libellé du niveau de criticité affiché à l'écran.",
    )
    is_active: Mapped[bool] = _is_active("Indique si le niveau peut encore être utilisé.")


class Unit(Base):
    __tablename__ = "R_UNITE"
    __table_args__ = table_args(
        comment="Référentiel des unités dans lesquelles sont exprimés les seuils des règles."
    )

    id: Mapped[int] = primary_key("Identifiant technique de l'unité.")
    code: Mapped[str] = mapped_column(
        "CD_UNITE",
        Text,
        nullable=False,
        unique=True,
        comment="Symbole de l'unité (s, m/s, m/s², °/s).",
    )
    label: Mapped[str] = mapped_column(
        "LB_UNITE", Text, nullable=False, comment="Libellé complet de l'unité."
    )
    is_active: Mapped[bool] = _is_active("Indique si l'unité peut encore être utilisée.")


class AircraftModel(Base):
    __tablename__ = "R_MODELE"
    __table_args__ = table_args(
        comment="Référentiel des modèles d'aéronefs, alimenté par la base de métadonnées OpenSky."
    )

    id: Mapped[int] = primary_key("Identifiant technique du modèle.")
    code: Mapped[str] = mapped_column(
        "CD_MODELE",
        Text,
        nullable=False,
        unique=True,
        comment="Code du type d'aéronef (clé métier).",
    )
    label: Mapped[str] = mapped_column(
        "LB_MODELE", Text, nullable=False, comment="Libellé complet du modèle."
    )
    is_active: Mapped[bool] = _is_active("Indique si le modèle peut encore être utilisé.")


class Airline(Base):
    __tablename__ = "R_COMPAGNIE"
    __table_args__ = table_args(
        Index(
            "idx_compagnie_libelle_trgm",
            "LB_COMPAGNIE",
            postgresql_using="gin",
            postgresql_ops={"LB_COMPAGNIE": "gin_trgm_ops"},
        ),
        comment=(
            "Référentiel des compagnies exploitantes, alimenté par la base de métadonnées OpenSky."
        ),
    )

    id: Mapped[int] = primary_key("Identifiant technique de la compagnie.")
    code: Mapped[str] = mapped_column(
        "CD_COMPAGNIE",
        Text,
        nullable=False,
        unique=True,
        comment="Code de la compagnie (clé métier).",
    )
    label: Mapped[str] = mapped_column(
        "LB_COMPAGNIE",
        Text,
        nullable=False,
        comment="Nom de la compagnie, utilisé par la recherche d'aéronefs.",
    )
    is_active: Mapped[bool] = _is_active("Indique si la compagnie peut encore être utilisée.")


class Airport(Base):
    __tablename__ = "R_AEROPORT"
    __table_args__ = table_args(
        comment="Référentiel des aéroports de départ et d'arrivée des vols."
    )

    id: Mapped[int] = primary_key("Identifiant technique de l'aéroport.")
    code: Mapped[str] = mapped_column(
        "CD_AEROPORT",
        Text,
        nullable=False,
        unique=True,
        comment="Code de l'aéroport (clé métier).",
    )
    label: Mapped[str] = mapped_column(
        "LB_AEROPORT", Text, nullable=False, comment="Nom de l'aéroport."
    )
    is_active: Mapped[bool] = _is_active("Indique si l'aéroport peut encore être utilisé.")


class CollectionStatus(Base):
    __tablename__ = "R_STATUT_COLLECTE"
    __table_args__ = table_args(
        comment=(
            "Référentiel des statuts d'un cycle de collecte OpenSky "
            "(succès, partiel, échec, quota atteint, ignoré)."
        )
    )

    id: Mapped[int] = primary_key("Identifiant technique du statut de collecte.")
    code: Mapped[str] = mapped_column(
        "CD_STATUT_COLLECTE",
        Text,
        nullable=False,
        unique=True,
        comment="Code stable du statut, utilisé par le collecteur.",
    )
    label: Mapped[str] = mapped_column(
        "LB_STATUT_COLLECTE",
        Text,
        nullable=False,
        comment="Libellé du statut affiché sur le tableau de bord.",
    )
    is_active: Mapped[bool] = _is_active("Indique si le statut peut encore être utilisé.")


class CollectionProfile(Base):
    __tablename__ = "R_PROFIL_COLLECTE"
    __table_args__ = table_args(
        comment=(
            "Référentiel des profils de collecte OpenSky (zone couverte et fréquence), "
            "choisis par configuration."
        )
    )

    id: Mapped[int] = primary_key("Identifiant technique du profil de collecte.")
    code: Mapped[str] = mapped_column(
        "CD_PROFIL_COLLECTE",
        Text,
        nullable=False,
        unique=True,
        comment="Code stable du profil, valeur du paramètre COLLECTION_PROFILE.",
    )
    label: Mapped[str] = mapped_column(
        "LB_PROFIL_COLLECTE",
        Text,
        nullable=False,
        comment="Libellé du profil affiché sur le tableau de bord.",
    )
    is_active: Mapped[bool] = _is_active("Indique si le profil peut encore être utilisé.")
