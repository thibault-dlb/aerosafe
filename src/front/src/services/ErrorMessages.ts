import type { TranslationKey } from "@/i18n/fr";
import { ApiError } from "@/services/ApiClient";

/** Texts (as translation keys) of the API failures a page explains, by HTTP status. */
export type ErrorKeys = Partial<Record<400 | 401 | 403 | 404 | 409 | 422 | 429, TranslationKey>>;

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

  /** The account list: changing, deactivating or anonymising an account. */
  static readonly ACCOUNTS = new ErrorMessages({
    403: "accounts.error.own",
    404: "accounts.error.notFound",
    409: "accounts.error.conflict",
  });

  /** Creating an account: the e-mail address may already have one. */
  static readonly NEW_ACCOUNT = new ErrorMessages({
    409: "auth.error.taken",
    422: "auth.error.invalidInput",
  });

  /** Choosing a new password: the current one is asked again. */
  static readonly PASSWORD = new ErrorMessages({
    400: "account.password.error.wrong",
    422: "account.password.error.invalid",
    429: "auth.error.locked",
  });

  /** Deleting one's own account: the password is asked again, and the last Supervisor stays. */
  static readonly DELETION = new ErrorMessages({
    400: "account.delete.error.wrong",
    409: "account.delete.error.lastSupervisor",
    429: "auth.error.locked",
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
