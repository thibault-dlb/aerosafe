import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient, ApiError } from "./ApiClient";
import { AuthService } from "./AuthService";

const USER = { id: "01HZ", email: "jane.doe@example.fr", role: "USER", is_active: true };

function tokens(access = "access-1", expiresIn = 900) {
  return { access_token: access, token_type: "bearer", expires_in: expiresIn, user: USER };
}

function serviceWith(post: ReturnType<typeof vi.fn>): AuthService {
  return new AuthService({ post } as unknown as ApiClient);
}

describe("AuthService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts without a token and with an unknown session", () => {
    const service = serviceWith(vi.fn());

    expect(service.token()).toBeNull();
    expect(service.snapshot()).toEqual({ status: "unknown", user: null });
  });

  it("logs in: keeps the token in memory and opens the session", async () => {
    const post = vi.fn().mockResolvedValue(tokens());
    const service = serviceWith(post);

    const user = await service.login("jane.doe@example.fr", "a long enough password");

    expect(post).toHaveBeenCalledWith("/v1/auth/login", {
      email: "jane.doe@example.fr",
      password: "a long enough password",
    });
    expect(user.email).toBe("jane.doe@example.fr");
    expect(service.token()).toBe("access-1");
    expect(service.snapshot()).toMatchObject({ status: "authenticated", user });
  });

  it("does not open a session when the log in fails", async () => {
    const service = serviceWith(vi.fn().mockRejectedValue(new ApiError(401)));

    await expect(service.login("a@b.fr", "x")).rejects.toMatchObject({ status: 401 });

    expect(service.token()).toBeNull();
    expect(service.snapshot().status).toBe("unknown");
  });

  it("signs up, then logs in with the same credentials", async () => {
    const post = vi.fn().mockResolvedValueOnce(USER).mockResolvedValueOnce(tokens());
    const service = serviceWith(post);

    await service.signUp("jane.doe@example.fr", "a long enough password");

    expect(post.mock.calls.map((call) => call[0])).toEqual(["/v1/auth/signup", "/v1/auth/login"]);
    expect(post.mock.calls[1][1]).toEqual({ email: "jane.doe@example.fr", password: "a long enough password" });
    expect(service.snapshot().status).toBe("authenticated");
  });

  it("does not log in when the sign up is refused", async () => {
    const post = vi.fn().mockRejectedValue(new ApiError(409));
    const service = serviceWith(post);

    await expect(service.signUp("a@b.fr", "x")).rejects.toMatchObject({ status: 409 });

    expect(post).toHaveBeenCalledTimes(1);
  });

  it("logs out: forgets the token even when the API cannot be reached", async () => {
    const post = vi.fn().mockResolvedValueOnce(tokens()).mockRejectedValueOnce(new TypeError("offline"));
    const service = serviceWith(post);
    await service.login("a@b.fr", "x");

    await service.logout();

    expect(post).toHaveBeenLastCalledWith("/v1/auth/logout");
    expect(service.token()).toBeNull();
    expect(service.snapshot()).toEqual({ status: "anonymous", user: null });
  });

  it("restores a session from the refresh cookie", async () => {
    const post = vi.fn().mockResolvedValue(tokens("restored"));
    const service = serviceWith(post);

    await service.restore();

    expect(post).toHaveBeenCalledWith("/v1/auth/refresh");
    expect(service.token()).toBe("restored");
    expect(service.snapshot().status).toBe("authenticated");
  });

  it("is anonymous when there is no session to restore", async () => {
    const service = serviceWith(vi.fn().mockRejectedValue(new ApiError(401)));

    await service.restore();

    expect(service.snapshot()).toEqual({ status: "anonymous", user: null });
  });

  it("is anonymous when the API cannot be reached at the first look", async () => {
    const service = serviceWith(vi.fn().mockRejectedValue(new TypeError("offline")));

    await service.restore();

    expect(service.snapshot().status).toBe("anonymous");
  });

  it("looks for a session only once", async () => {
    const post = vi.fn().mockResolvedValue(tokens());
    const service = serviceWith(post);

    await service.restore();
    await service.restore();

    expect(post).toHaveBeenCalledTimes(1);
  });

  it("sends one refresh at a time: the refresh token is single use", async () => {
    let finish: (value: unknown) => void = () => undefined;
    const post = vi.fn().mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const service = serviceWith(post);

    const first = service.renew();
    const second = service.renew();
    finish(tokens());

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("does not ask the API to renew an anonymous session", async () => {
    const post = vi.fn().mockRejectedValue(new ApiError(401));
    const service = serviceWith(post);
    await service.restore();
    post.mockClear();

    await expect(service.renew()).resolves.toBe(false);

    expect(post).not.toHaveBeenCalled();
  });

  it("ends the session when the refresh is refused", async () => {
    const post = vi.fn().mockResolvedValueOnce(tokens()).mockRejectedValueOnce(new ApiError(401));
    const service = serviceWith(post);
    await service.login("a@b.fr", "x");

    await expect(service.renew()).resolves.toBe(false);

    expect(service.token()).toBeNull();
    expect(service.snapshot().status).toBe("anonymous");
  });

  it("keeps the session when the refresh fails for another reason", async () => {
    const post = vi.fn().mockResolvedValueOnce(tokens()).mockRejectedValueOnce(new TypeError("offline"));
    const service = serviceWith(post);
    await service.login("a@b.fr", "x");

    await expect(service.renew()).resolves.toBe(false);

    expect(service.snapshot().status).toBe("authenticated");
    expect(service.token()).toBe("access-1");
  });

  it("renews the access token before it expires", async () => {
    const post = vi.fn().mockResolvedValueOnce(tokens("first", 900)).mockResolvedValueOnce(tokens("second", 900));
    const service = serviceWith(post);
    await service.login("a@b.fr", "x");

    await vi.advanceTimersByTimeAsync((900 - AuthService.RENEW_MARGIN_SECONDS) * 1000 - 1);
    expect(service.token()).toBe("first");
    await vi.advanceTimersByTimeAsync(2);

    expect(service.token()).toBe("second");
    expect(post).toHaveBeenLastCalledWith("/v1/auth/refresh");
  });

  it("never renews faster than the minimum delay", async () => {
    const post = vi.fn().mockResolvedValueOnce(tokens("first", 10)).mockResolvedValue(tokens("second", 900));
    const service = serviceWith(post);
    await service.login("a@b.fr", "x");

    await vi.advanceTimersByTimeAsync(AuthService.MIN_DELAY_MS - 1);
    expect(post).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2);

    expect(post).toHaveBeenCalledTimes(2);
  });

  it("stops renewing once logged out", async () => {
    const post = vi.fn().mockResolvedValue(tokens());
    const service = serviceWith(post);
    await service.login("a@b.fr", "x");
    await service.logout();
    post.mockClear();

    await vi.advanceTimersByTimeAsync(3_600_000);

    expect(post).not.toHaveBeenCalled();
  });

  it("tells the listeners about each change, until they unsubscribe", async () => {
    const service = serviceWith(vi.fn().mockResolvedValue(tokens()));
    const listener = vi.fn();
    const stop = service.subscribe(listener);

    await service.login("a@b.fr", "x");
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    await service.logout();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("gives the same snapshot until something changes", async () => {
    const service = serviceWith(vi.fn().mockResolvedValue(tokens()));
    const before = service.snapshot();

    expect(service.snapshot()).toBe(before);
    await service.login("a@b.fr", "x");

    expect(service.snapshot()).not.toBe(before);
  });

  it("uses the browser lock for the refresh when there is one", async () => {
    const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
    vi.stubGlobal("navigator", { locks: { request } });
    const service = serviceWith(vi.fn().mockResolvedValue(tokens()));

    await service.restore();

    expect(request).toHaveBeenCalledWith("aerosafe-session-refresh", expect.any(Function));
    vi.unstubAllGlobals();
  });
});
