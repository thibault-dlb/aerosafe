import type { TranslationKey } from "@/i18n/fr";
import { ApiError } from "@/services/ApiClient";

/** Turns the failure of a log in or a sign up into the key of a text for the user. */
export class AuthMessages {
  static key(error: unknown): TranslationKey {
    if (error instanceof ApiError) {
      switch (error.status) {
        case 401:
          return "auth.error.invalid";
        case 409:
          return "auth.error.taken";
        case 422:
          return "auth.error.invalidInput";
        case 429:
          return "auth.error.locked";
      }
    }
    return "auth.error.network";
  }
}
