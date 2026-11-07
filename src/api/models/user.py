from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Text,
    true,
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
from models.reference import Role


class User(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "UTILISATEUR"
    __table_args__ = table_args(
        CheckConstraint(f"\"CD_ULID\" ~ '{ULID_PATTERN}'", name="ulid_format"),
        # Only an anonymised account may lose its password hash.
        CheckConstraint(
            '"LB_HASH_MOT_DE_PASSE" IS NOT NULL OR "DT_ANONYMISATION" IS NOT NULL',
            name="password_unless_anonymised",
        ),
        Index("idx_utilisateur_role", "ID_ROLE"),
        comment="Compte applicatif, créé à l'inscription ; anonymisé sur demande, jamais supprimé.",
    )

    id: Mapped[int] = primary_key("Identifiant technique de l'utilisateur.")
    email: Mapped[str] = mapped_column(
        "LN_EMAIL",
        Text,
        nullable=False,
        unique=True,
        comment=(
            "Adresse e-mail de connexion, unique ; "
            "remplacée à l'anonymisation par anonyme-<CD_ULID>@aerosafe.invalid."
        ),
    )
    password_hash: Mapped[str | None] = mapped_column(
        "LB_HASH_MOT_DE_PASSE",
        Text,
        comment="Empreinte argon2id du mot de passe ; NULL seulement après anonymisation.",
    )
    role_id: Mapped[int] = mapped_column(
        "ID_ROLE",
        BigInteger,
        ForeignKey("R_ROLE.ID", ondelete="RESTRICT"),
        nullable=False,
        comment="Rôle de l'utilisateur.",
    )
    anonymised_at: Mapped[datetime | None] = mapped_column(
        "DT_ANONYMISATION",
        DateTime(timezone=True),
        comment="Date d'anonymisation du compte ; NULL si le compte n'est pas anonymisé.",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=true(),
        comment="Indique si le compte peut se connecter.",
    )

    role: Mapped[Role] = relationship(lazy="raise")


class RefreshToken(TimestampMixin, Base):
    __tablename__ = "JETON_RAFRAICHISSEMENT"
    __table_args__ = table_args(
        Index("idx_jeton_utilisateur", "ID_UTILISATEUR"),
        comment="Jeton de rafraîchissement émis à la connexion ; seule son empreinte est stockée.",
    )

    id: Mapped[int] = primary_key("Identifiant technique du jeton.")
    user_id: Mapped[int] = mapped_column(
        "ID_UTILISATEUR",
        BigInteger,
        ForeignKey("UTILISATEUR.ID", ondelete="RESTRICT"),
        nullable=False,
        comment="Utilisateur propriétaire du jeton.",
    )
    token_hash: Mapped[str] = mapped_column(
        "CD_HASH_JETON",
        Text,
        nullable=False,
        unique=True,
        comment="Empreinte du jeton ; le jeton lui-même reste dans un cookie HttpOnly.",
    )
    expires_at: Mapped[datetime] = mapped_column(
        "DT_EXPIRATION",
        DateTime(timezone=True),
        nullable=False,
        comment="Date d'expiration du jeton.",
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        "DT_REVOCATION",
        DateTime(timezone=True),
        comment=(
            "Date de révocation (déconnexion, désactivation, anonymisation) ; "
            "NULL si le jeton est valide."
        ),
    )
