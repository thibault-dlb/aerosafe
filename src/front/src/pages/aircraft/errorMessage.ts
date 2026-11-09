import { ApiError } from "@/services/ApiClient";

/** A message for the user from an API failure. */
export function errorMessage(error: unknown, notFound = "Not found."): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Log in to look up aircraft.";
    if (error.status === 403) return "You are not allowed to see this page.";
    if (error.status === 404) return notFound;
    if (error.status === 422) return "Check the search criteria.";
  }
  return "The server could not be reached. Try again later.";
}
