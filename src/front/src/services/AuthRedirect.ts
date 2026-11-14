/** Where to go after a log in: the page that was asked for, otherwise the dashboard. */
export class AuthRedirect {
  static readonly DEFAULT = "/dashboard";

  /** The router state to give with the redirection to the log in screen. */
  static state(from: string): { from: string } {
    return { from };
  }

  /**
   * The page to open after the log in. The state comes from the browser history, so only an
   * address inside the application is accepted, and never the log in screen itself.
   */
  static target(state: unknown): string {
    const from = typeof state === "object" && state !== null ? (state as { from?: unknown }).from : undefined;
    if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//")) {
      return AuthRedirect.DEFAULT;
    }
    if (/^\/(login|signup)(\/|\?|#|$)/.test(from)) {
      return AuthRedirect.DEFAULT;
    }
    return from;
  }
}
