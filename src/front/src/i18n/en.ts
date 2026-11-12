import type { TranslationKey } from "./fr";

/** English texts. A key missing here or in `fr.ts` breaks the type check. */
export const en: Record<TranslationKey, string> = {
  "nav.main": "Main navigation",
  "nav.home": "Home",
  "nav.aircraft": "Aircraft",
  "nav.dashboard": "Dashboard",
  "nav.alerts": "Alerts",
  "nav.rules": "Rules",
  "nav.accounts": "Accounts",
  "nav.login": "Log in",
  "nav.openMenu": "Open the menu",
  "nav.closeMenu": "Close the menu",

  "language.label": "Language",
  "language.fr": "Français",
  "language.en": "English",

  "theme.label": "Theme",
  "theme.dark": "Dark",
  "theme.light": "Light",
  "theme.toLight": "Switch to the light theme",
  "theme.toDark": "Switch to the dark theme",

  "layout.skipToContent": "Skip to the content",

  "footer.disclaimer":
    "AeroSafe is an educational project. It is not a certified air traffic surveillance or management system and must not be used operationally.",
  "footer.data": "Data: The OpenSky Network. Map: © OpenStreetMap contributors.",
};
