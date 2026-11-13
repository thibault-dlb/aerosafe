import type { TranslationKey } from "@/i18n/fr";
import { ApiError } from "@/services/ApiClient";

/**
 * The text key of an API failure on the aircraft and flight pages. `notFound` is for a 404;
 * `invalid` is for a 422 and is the same text by default, since an identifier that is not
 * valid is an item that does not exist.
 */
export function errorKey(
  failure: unknown,
  notFound: TranslationKey,
  invalid: TranslationKey = notFound,
): TranslationKey {
  if (failure instanceof ApiError) {
    switch (failure.status) {
      case 401:
        return "aircraft.error.login";
      case 403:
        return "aircraft.error.forbidden";
      case 404:
        return notFound;
      case 422:
        return invalid;
    }
  }
  return "aircraft.error.unreachable";
}
