import type { TranslationKey } from "@/i18n/fr";
import { ApiError } from "@/services/ApiClient";

/** The text key of an API failure on the aircraft and flight pages. `notFound` is for a 404. */
export function errorKey(failure: unknown, notFound: TranslationKey): TranslationKey {
  if (failure instanceof ApiError) {
    switch (failure.status) {
      case 401:
        return "aircraft.error.login";
      case 403:
        return "aircraft.error.forbidden";
      case 404:
        return notFound;
      case 422:
        return "aircraft.error.criteria";
    }
  }
  return "aircraft.error.unreachable";
}
