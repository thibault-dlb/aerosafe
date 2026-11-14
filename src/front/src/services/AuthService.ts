import { User, type UserJson } from "@/models/User";
import { ApiClient, ApiError } from "@/services/ApiClient";

interface TokenResponseJson {
  access_token: string;
  token_type: string;
  /** Lifetime of the access token, in seconds. */
  expires_in: number;
  user: UserJson;
}

/** `unknown` until the first answer of the API: a stored session may still be there. */
export type SessionStatus = "unknown" | "authenticated" | "anonymous";

/** What the interface knows about the visitor. A new object is made at each change. */
export interface Session {
  readonly status: SessionStatus;
  readonly user: User | null;
}

/**
 * Logs in, signs up and out, and keeps the session alive. The access token is held in memory
 * only; the refresh token lives in an `HttpOnly` cookie that the page cannot read. Each refresh
 * token is single use, so only one refresh runs at a time, in this tab and across the tabs.
 */
export class AuthService {
  /** The access token is renewed this long before it expires. */
  static readonly RENEW_MARGIN_SECONDS = 60;
  /** Never renew more often than this, whatever the lifetime the API announces. */
  static readonly MIN_DELAY_MS = 5_000;
  private static readonly LOCK_NAME = "aerosafe-session-refresh";

  private accessToken: string | null = null;
  private session: Session = { status: "unknown", user: null };
  private readonly listeners = new Set<() => void>();
  private renewing: Promise<boolean> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly client: ApiClient = new ApiClient()) {}

  /** The access token to send with a request, or null. */
  token(): string | null {
    return this.accessToken;
  }

  /** The current session. The same object until the session changes. */
  readonly snapshot = (): Session => this.session;

  /** Calls `listener` at each change of the session. Returns the function that stops it. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  async login(email: string, password: string): Promise<User> {
    const body = await this.client.post<TokenResponseJson>("/v1/auth/login", { email, password });
    return this.open(body);
  }

  /** The API creates the account without opening a session, so the new user is logged in at once. */
  async signUp(email: string, password: string): Promise<User> {
    await this.client.post("/v1/auth/signup", { email, password });
    return this.login(email, password);
  }

  async logout(): Promise<void> {
    try {
      await this.client.post("/v1/auth/logout");
    } catch {
      // The session is closed on this side anyway; an unreachable API only keeps the cookie.
    }
    this.close();
  }

  /** Looks for a session kept by the refresh cookie. Does nothing once the answer is known. */
  async restore(): Promise<void> {
    if (this.session.status === "unknown") {
      await this.renew();
    }
  }

  /** Swaps the refresh cookie for a new access token. Resolves true when there is one. */
  renew(): Promise<boolean> {
    if (this.session.status === "anonymous") {
      return Promise.resolve(false);
    }
    this.renewing ??= this.exchange().finally(() => {
      this.renewing = null;
    });
    return this.renewing;
  }

  private async exchange(): Promise<boolean> {
    try {
      const body = await AuthService.alone(() => this.client.post<TokenResponseJson>("/v1/auth/refresh"));
      this.open(body);
      return true;
    } catch (error) {
      const over = error instanceof ApiError && error.status === 401;
      // An unreachable API proves nothing about a session that was open: only the first look gives up.
      if (over || this.session.status === "unknown") {
        this.close();
      }
      return false;
    }
  }

  /** Runs one refresh at a time across the tabs of the browser, where the browser can say so. */
  private static async alone<T>(task: () => Promise<T>): Promise<T> {
    const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
    return locks ? await locks.request(AuthService.LOCK_NAME, task) : task();
  }

  private open(body: TokenResponseJson): User {
    const user = User.fromJson(body.user);
    this.accessToken = body.access_token;
    this.session = { status: "authenticated", user };
    this.scheduleRenewal(body.expires_in);
    this.notify();
    return user;
  }

  private close(): void {
    clearTimeout(this.timer);
    this.accessToken = null;
    if (this.session.status !== "anonymous") {
      this.session = { status: "anonymous", user: null };
      this.notify();
    }
  }

  private scheduleRenewal(expiresIn: number): void {
    clearTimeout(this.timer);
    const delay = Math.max(AuthService.MIN_DELAY_MS, (expiresIn - AuthService.RENEW_MARGIN_SECONDS) * 1000);
    this.timer = setTimeout(() => void this.renew(), delay);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}
