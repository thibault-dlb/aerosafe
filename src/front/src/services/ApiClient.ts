import { RuntimeConfig } from "@/config/RuntimeConfig";

export type TokenProvider = () => string | null;

/** Tries to renew the session after a 401. Resolves true when a new access token is available. */
export type SessionRenewer = () => Promise<boolean>;

/** A response with an error status. `status` lets callers handle 401 and 403. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Request failed with status ${status}`);
    this.status = status;
  }
}

/** Thin wrapper around fetch for the backend API. */
export class ApiClient {
  /** The authentication endpoints answer 401 for a wrong password: renewing the session would not help. */
  private static readonly AUTH_PATH = "/v1/auth";

  private static tokenProvider: TokenProvider = () => null;

  private static sessionRenewer: SessionRenewer | null = null;

  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? RuntimeConfig.get().apiBaseUrl;
  }

  /** Sets where every client reads the access token from. The auth work package calls this. */
  static setTokenProvider(provider: TokenProvider): void {
    ApiClient.tokenProvider = provider;
  }

  /** Sets what runs after a 401 on a request: if it renews the session, the request is sent once more. */
  static setSessionRenewer(renewer: SessionRenewer | null): void {
    ApiClient.sessionRenewer = renewer;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  private async request<T>(method: string, path: string, body?: unknown, replayed = false): Promise<T> {
    const headers: Record<string, string> = {};
    const token = ApiClient.tokenProvider();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    // `include` sends the HttpOnly refresh token cookie.
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 401 && !replayed && !path.startsWith(ApiClient.AUTH_PATH)) {
      const renewer = ApiClient.sessionRenewer;
      if (renewer && (await renewer())) {
        return this.request<T>(method, path, body, true);
      }
    }
    if (!response.ok) {
      throw new ApiError(response.status);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }
}
