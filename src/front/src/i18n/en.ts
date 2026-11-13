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

  "mode.label": "Data source",
  "mode.live": "Live",
  "mode.replay": "Replay",

  "replay.bar": "Historical traffic replay",
  "replay.time": "Simulated time",
  "replay.loading": "Loading the replay clock…",
  "replay.unavailable": "No replay data is imported in the database.",
  "replay.notStarted": "The replay has not started. A supervisor can start it at any time they choose.",
  "replay.finished": "End of the data reached: the replay is stopped.",
  "replay.period": "Available period: {start} → {end} (UTC)",
  "replay.pause": "Pause",
  "replay.resume": "Resume",
  "replay.speed": "Speed",
  "replay.speedOption": "×{speed}",
  "replay.startAt": "Start at (UTC)",
  "replay.start": "Start",
  "replay.error.unauthenticated": "Log in to see the replay.",
  "replay.error.forbidden": "Only a supervisor can drive the replay.",
  "replay.error.invalid": "Time or speed refused: choose a time inside the available period.",
  "replay.error.failed": "The replay clock cannot be reached. Trying again in a few seconds.",

  "home.tagline": "Live aeronautical data monitoring",
  "home.pitch":
    "AeroSafe tracks aircraft over France, spots abnormal situations with five business rules and raises alerts for supervisors.",
  "home.cta.login": "Log in",
  "home.cta.search": "Search for an aircraft",
  "home.disclaimer":
    "Educational project: AeroSafe is not a certified air traffic surveillance or management tool. It must never be used operationally.",
  "overview.live.title": "Live · Île-de-France",
  "overview.replay.title": "Replay · {time} UTC · France",
  "overview.replay.waiting": "Replay not started",
  "overview.replay.login": "Log in to see the traffic replay.",
  "overview.live.loading": "Loading the data…",
  "overview.live.login": "Log in to see the live traffic.",
  "overview.live.error": "Some data could not be loaded. Trying again in a few seconds.",
  "overview.stat.aircraft": "Tracked aircraft",
  "overview.stat.active": "Active alerts",
  "overview.stat.day": "Alerts (24 h)",
  "home.features.title": "Explore",
  "home.features.aircraft": "Search for an aircraft, open its record and the trajectory of its flights.",
  "home.features.dashboard": "Follow the state of the collection and the active alerts.",
  "home.features.alerts": "Review the alerts and mark them as processed.",
  "home.features.rules": "Adjust the thresholds of rules R1 to R5.",

  "footer.disclaimer":
    "AeroSafe is an educational project. It is not a certified air traffic surveillance or management system and must not be used operationally.",
  "footer.data": "Data: The OpenSky Network. Map: © OpenStreetMap contributors.",
};
