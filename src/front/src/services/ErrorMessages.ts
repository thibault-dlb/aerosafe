import { ApiError } from "@/services/ApiClient";

/** Texts of the API failures a page explains, by HTTP status. */
export type ErrorTexts = Partial<Record<401 | 403 | 404 | 409 | 422, string>>;

/** Turns an API failure into a message for the user. Each page gives the texts that depend
 * on what it shows; the others keep a general wording. */
export class ErrorMessages {
  static readonly UNREACHABLE = "The server could not be reached. Try again later.";

  private static readonly GENERAL: ErrorTexts = {
    401: "Log in to see this page.",
    403: "You are not allowed to see this page.",
    404: "Not found.",
    409: "This change conflicts with the current state. Reload and try again.",
    422: "Check the values entered.",
  };

  /** Pages reserved to Supervisors: alerts and rules. */
  static readonly SUPERVISOR = new ErrorMessages({
    401: "Log in as a Supervisor to see this page.",
    403: "Only Supervisors can see this page.",
    404: "This item no longer exists.",
    409: "This alert was already processed.",
  });

  private readonly texts: ErrorTexts;

  constructor(texts: ErrorTexts = {}) {
    this.texts = { ...ErrorMessages.GENERAL, ...texts };
  }

  /** The message for this failure; any failure without an HTTP status is a network one. */
  describe(error: unknown): string {
    if (error instanceof ApiError) {
      const text = this.texts[error.status as keyof ErrorTexts];
      if (text !== undefined) return text;
    }
    return ErrorMessages.UNREACHABLE;
  }
}
