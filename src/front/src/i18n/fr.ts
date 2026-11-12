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

  "footer.disclaimer":
    "AeroSafe est un projet pédagogique. Ce n'est pas un système certifié de surveillance ou de gestion du trafic aérien et il ne doit pas servir à un usage opérationnel.",
  "footer.data": "Données : The OpenSky Network. Fond de carte : © contributeurs OpenStreetMap.",
} as const;

export type TranslationKey = keyof typeof fr;
