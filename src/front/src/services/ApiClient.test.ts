import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "./ApiClient";

describe("ApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.RUNTIME_CONFIG = undefined;
  });

  it("returns the parsed JSON of a successful request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ApiClient("http://api").get<{ status: string }>("/health");

    expect(result).toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith("http://api/health");
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(new ApiClient("http://api").get("/health")).rejects.toThrow("status 500");
  });

  it("uses the runtime configuration by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    window.RUNTIME_CONFIG = { apiBaseUrl: "http://configured" };

    await new ApiClient().get("/x");

    expect(fetchMock).toHaveBeenCalledWith("http://configured/x");
  });
});
