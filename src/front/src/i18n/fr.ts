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

  "mode.label": "Source des données",
  "mode.live": "Direct",
  "mode.replay": "Rejeu",

  "replay.bar": "Rejeu du trafic historique",
  "replay.time": "Instant simulé",
  "replay.loading": "Chargement de l'horloge de rejeu…",
  "replay.unavailable": "Aucune donnée de rejeu n'est importée dans la base.",
  "replay.notStarted": "Le rejeu n'a pas démarré. Un superviseur peut le lancer à l'instant de son choix.",
  "replay.finished": "Fin des données atteinte : le rejeu est arrêté.",
  "replay.period": "Période disponible : {start} → {end} (UTC)",
  "replay.pause": "Pause",
  "replay.resume": "Reprendre",
  "replay.speed": "Vitesse",
  "replay.speedOption": "×{speed}",
  "replay.startAt": "Démarrer à (UTC)",
  "replay.start": "Démarrer",
  "replay.error.unauthenticated": "Connectez-vous pour voir le rejeu.",
  "replay.error.forbidden": "Seul un superviseur peut piloter le rejeu.",
  "replay.error.invalid": "Instant ou vitesse refusés : choisissez un instant dans la période disponible.",
  "replay.error.failed": "L'horloge de rejeu est injoignable. Nouvel essai dans quelques secondes.",

  "home.tagline": "Surveillance des données aéronautiques en direct",
  "home.pitch":
    "AeroSafe suit les aéronefs au-dessus de la France, repère les situations anormales avec cinq règles métier et lève des alertes pour les superviseurs.",
  "home.cta.login": "Se connecter",
  "home.cta.search": "Rechercher un aéronef",
  "layout.disclaimer":
    "Projet pédagogique : AeroSafe n'est pas un outil certifié de surveillance ou de gestion du trafic aérien. Il ne doit jamais servir à un usage opérationnel.",
  "overview.live.title": "En direct · Île-de-France",
  "overview.replay.title": "Rejeu · {time} UTC · France",
  "overview.replay.waiting": "Rejeu non démarré",
  "overview.replay.login": "Connectez-vous pour voir le rejeu du trafic.",
  "overview.live.loading": "Chargement des données…",
  "overview.live.login": "Connectez-vous pour voir le trafic en direct.",
  "overview.live.error": "Certaines données n'ont pas pu être chargées. Nouvel essai dans quelques secondes.",
  "overview.stat.aircraft": "Aéronefs suivis",
  "overview.stat.active": "Alertes actives",
  "overview.stat.day": "Alertes (24 h)",
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
