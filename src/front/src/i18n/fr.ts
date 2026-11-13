/** French texts: the reference dictionary. `en.ts` must have exactly the same keys. */
export const fr = {
  "nav.main": "Navigation principale",
  "nav.home": "Accueil",
  "nav.aircraft": "Aéronefs",
  "nav.dashboard": "Tableau de bord",
  "nav.alerts": "Alertes",
  "nav.rules": "Règles",
  "nav.accounts": "Comptes",
  "nav.login": "Connexion",
  "nav.openMenu": "Ouvrir le menu",
  "nav.closeMenu": "Fermer le menu",

  "language.label": "Langue",
  "language.fr": "Français",
  "language.en": "English",

  "theme.label": "Thème",
  "theme.dark": "Sombre",
  "theme.light": "Clair",
  "theme.toLight": "Passer au thème clair",
  "theme.toDark": "Passer au thème sombre",

  "layout.skipToContent": "Aller au contenu",

  "home.tagline": "Surveillance des données aéronautiques en direct",
  "home.pitch":
    "AeroSafe suit les aéronefs au-dessus de la France, repère les situations anormales avec cinq règles métier et lève des alertes pour les superviseurs.",
  "home.cta.login": "Se connecter",
  "home.cta.search": "Rechercher un aéronef",
  "home.disclaimer":
    "Projet pédagogique : AeroSafe n'est pas un outil certifié de surveillance ou de gestion du trafic aérien. Il ne doit jamais servir à un usage opérationnel.",
  "home.live.title": "En direct · Île-de-France",
  "home.live.loading": "Chargement des données…",
  "home.live.login": "Connectez-vous pour voir le trafic en direct.",
  "home.live.error": "Certaines données n'ont pas pu être chargées. Nouvel essai dans quelques secondes.",
  "home.stat.aircraft": "Aéronefs suivis",
  "home.stat.active": "Alertes actives",
  "home.stat.day": "Alertes (24 h)",
  "home.features.title": "Explorer",
  "home.features.aircraft": "Recherchez un aéronef, consultez sa fiche et la trajectoire de ses vols.",
  "home.features.dashboard": "Suivez l'état de la collecte et les alertes actives.",
  "home.features.alerts": "Passez les alertes en revue et marquez-les comme traitées.",
  "home.features.rules": "Réglez les seuils des règles R1 à R5.",

  "footer.disclaimer":
    "AeroSafe est un projet pédagogique. Ce n'est pas un système certifié de surveillance ou de gestion du trafic aérien et il ne doit pas servir à un usage opérationnel.",
  "footer.data": "Données : The OpenSky Network. Fond de carte : © contributeurs OpenStreetMap.",
} as const;

export type TranslationKey = keyof typeof fr;
