import type { TranslationKey } from "@/i18n/fr";
import { ApiError } from "@/services/ApiClient";

/** Texts (as translation keys) of the API failures a page explains, by HTTP status. */
export type ErrorKeys = Partial<Record<401 | 403 | 404 | 409 | 422, TranslationKey>>;

/**
 * Turns an API failure into the key of a message for the user. Each page gives the texts that
 * depend on what it shows; the others keep a general wording.
 */
export class ErrorMessages {
  static readonly UNREACHABLE: TranslationKey = "error.unreachable";

  private static readonly GENERAL: ErrorKeys = {
    401: "error.login",
    403: "error.forbidden",
    404: "error.notFound",
    409: "error.conflict",
    422: "error.invalid",
  };

  /** Pages reserved to Supervisors: alerts and rules. */
  static readonly SUPERVISOR = new ErrorMessages({
    401: "error.supervisor.login",
    403: "error.supervisor.forbidden",
    404: "error.supervisor.notFound",
    409: "error.supervisor.conflict",
  });

  private readonly keys: ErrorKeys;

  constructor(keys: ErrorKeys = {}) {
    this.keys = { ...ErrorMessages.GENERAL, ...keys };
  }

  /** The message for this failure; any failure without an HTTP status is a network one. */
  key(error: unknown): TranslationKey {
    if (error instanceof ApiError) {
      const key = this.keys[error.status as keyof ErrorKeys];
      if (key !== undefined) return key;
    }
    return ErrorMessages.UNREACHABLE;
  }
}
