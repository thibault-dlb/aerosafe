import { PreferenceStore } from "@/services/PreferenceStore";

export type Theme = "dark" | "light";

/**
 * The colour theme (see `styles/tokens.css`). The dark theme is the default.
 * The `data-theme` attribute of the page is set only once the user has made a choice:
 * before that, the style sheet follows the system setting.
 */
export class ThemeService {
  static readonly KEY = "aerosafe.theme";
  static readonly DEFAULT: Theme = "dark";

  constructor(
    private readonly store: PreferenceStore = new PreferenceStore(),
    private readonly root: HTMLElement = document.documentElement,
  ) {}

  private static isTheme(value: string | null): value is Theme {
    return value === "dark" || value === "light";
  }

  private static systemPrefersLight(): boolean {
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches;
  }

  /** The theme chosen by the user, or the one of the system when none was chosen. */
  current(): Theme {
    const stored = this.store.get(ThemeService.KEY);
    if (ThemeService.isTheme(stored)) {
      return stored;
    }
    return ThemeService.systemPrefersLight() ? "light" : ThemeService.DEFAULT;
  }

  /** Puts the saved choice on the page. Call it once at start-up. */
  apply(): void {
    const stored = this.store.get(ThemeService.KEY);
    if (ThemeService.isTheme(stored)) {
      this.root.setAttribute("data-theme", stored);
    } else {
      this.root.removeAttribute("data-theme");
    }
  }

  set(theme: Theme): void {
    this.store.set(ThemeService.KEY, theme);
    this.apply();
  }
}
