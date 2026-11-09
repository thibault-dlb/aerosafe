import { ApiError } from "@/services/ApiClient";

/** A message for the Supervisor from an API failure on alerts or rules. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Log in as a Supervisor to see this page.";
    if (error.status === 403) return "Only Supervisors can see this page.";
    if (error.status === 404) return "This item no longer exists.";
    if (error.status === 409) return "This alert was already processed.";
    if (error.status === 422) return "Check the values entered.";
  }
  return "The server could not be reached. Try again later.";
}
