"""Update the comments that name OpenSky as the only live source.

A single change: the comments of the reference, collection, aircraft and observation tables
now describe the two live sources (OpenSky and adsb.fi) and the parameter row of each one.
Nothing else is touched; the downgrade puts the previous comments back.

Revision ID: 0061
Revises: 0060
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0061"
down_revision: str | None = "0060"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Target of COMMENT ON, then the new comment and the previous one.
_COMMENTS: tuple[tuple[str, str, str], ...] = (
    (
        'TABLE "R_SOURCE_DONNEE"',
        "Référentiel des sources de données d'un aéronef : "
        "collecte en direct OpenSky ou adsb.fi, ou trafic historique rejoué.",
        "Référentiel des sources de données d'un aéronef : "
        "collecte OpenSky en direct ou trafic historique rejoué.",
    ),
    (
        'COLUMN "R_SOURCE_DONNEE"."CD_SOURCE_DONNEE"',
        "Code stable de la source, utilisé par l'API (DIRECT pour OpenSky, ADSBFI ou REJEU).",
        "Code stable de la source, utilisé par l'API (DIRECT ou REJEU).",
    ),
    (
        'TABLE "AERONEF"',
        "Aéronef suivi, créé à la première observation de son code ICAO24 dans sa source "
        "(collecte OpenSky, collecte adsb.fi ou import historique).",
        "Aéronef suivi, créé par le collecteur OpenSky "
        "à la première observation de son code ICAO24.",
    ),
    (
        'COLUMN "AERONEF"."ID_SOURCE_DONNEE"',
        "Source de l'aéronef : collecte OpenSky en direct (DIRECT, par défaut), "
        "collecte adsb.fi en direct (ADSBFI) ou trafic historique rejoué (REJEU).",
        "Source de l'aéronef : collecte en direct (DIRECT, par défaut) "
        "ou trafic historique rejoué (REJEU).",
    ),
    (
        'TABLE "R_PROFIL_COLLECTE"',
        "Référentiel des profils de collecte en direct, OpenSky ou adsb.fi "
        "(zone couverte et fréquence), choisis par configuration.",
        "Référentiel des profils de collecte OpenSky (zone couverte et fréquence), "
        "choisis par configuration.",
    ),
    (
        'COLUMN "R_PROFIL_COLLECTE"."CD_PROFIL_COLLECTE"',
        "Code stable du profil : valeur du paramètre COLLECTION_PROFILE pour OpenSky, "
        "ADSBFI_250NM pour adsb.fi.",
        "Code stable du profil, valeur du paramètre COLLECTION_PROFILE.",
    ),
    (
        'TABLE "R_STATUT_COLLECTE"',
        "Référentiel des statuts d'un cycle de collecte en direct "
        "(succès, partiel, échec, quota atteint, ignoré).",
        "Référentiel des statuts d'un cycle de collecte OpenSky "
        "(succès, partiel, échec, quota atteint, ignoré).",
    ),
    (
        'TABLE "EXECUTION_COLLECTE"',
        "Cycle de collecte en direct (OpenSky ou adsb.fi), une ligne par cycle créée par le "
        "collecteur ; figée une fois DT_FIN renseignée.",
        "Cycle de collecte OpenSky, une ligne par cycle créée par le collecteur ; "
        "figée une fois DT_FIN renseignée.",
    ),
    (
        'COLUMN "EXECUTION_COLLECTE"."NB_ETATS_RECUS"',
        "Nombre de vecteurs d'état reçus de la source.",
        "Nombre de vecteurs d'état reçus d'OpenSky.",
    ),
    (
        'COLUMN "EXECUTION_COLLECTE"."NB_CREDITS_RESTANTS"',
        "Crédits OpenSky restants selon l'en-tête X-Rate-Limit-Remaining ; NULL si absent, "
        "et toujours pour adsb.fi, qui n'a pas de crédits.",
        "Crédits OpenSky restants selon l'en-tête X-Rate-Limit-Remaining ; NULL si absent.",
    ),
    (
        'TABLE "PARAMETRE_COLLECTE"',
        "État de chaque collecte en direct, une ligne par source : la pause décidée par le "
        "Superviseur survit au redémarrage de l'API.",
        "État de la collecte, une seule ligne : la pause décidée par le Superviseur "
        "survit au redémarrage de l'API.",
    ),
    (
        'TABLE "OBSERVATION"',
        "Vecteur d'état d'un aéronef reçu de sa source (OpenSky, adsb.fi ou trafic historique), "
        "nettoyé puis stocké.",
        "Vecteur d'état d'un aéronef reçu d'OpenSky, nettoyé puis stocké par le collecteur.",
    ),
)


def _comment(target: str, text: str) -> str:
    escaped = text.replace("'", "''")
    return f"COMMENT ON {target} IS '{escaped}'"


def upgrade() -> None:
    for target, new, _ in _COMMENTS:
        op.execute(_comment(target, new))


def downgrade() -> None:
    for target, _, previous in _COMMENTS:
        op.execute(_comment(target, previous))
