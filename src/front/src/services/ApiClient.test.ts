import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClient, ApiError } from "./ApiClient";

function stubFetch(response: object = { ok: true, status: 200, json: async () => ({}) }) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.RUNTIME_CONFIG = undefined;
    ApiClient.setTokenProvider(() => null);
  });

  it("returns the parsed JSON of a successful request", async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: async () => ({ status: "ok" }) });

    const result = await new ApiClient("http://api").get<{ status: string }>("/health");

    expect(result).toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api/health",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("throws an error carrying the status when the response is not ok", async () => {
    stubFetch({ ok: false, status: 500 });

    const request = new ApiClient("http://api").get("/health");

    await expect(request).rejects.toThrow("status 500");
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 500 });
  });

  it("uses the runtime configuration by default", async () => {
    const fetchMock = stubFetch();
    window.RUNTIME_CONFIG = { apiBaseUrl: "http://configured" };

    await new ApiClient().get("/x");

    expect(fetchMock).toHaveBeenCalledWith("http://configured/x", expect.anything());
  });

  it.each(["post", "patch"] as const)("sends a JSON body with %s", async (method) => {
    const fetchMock = stubFetch();

    await new ApiClient("http://api")[method]("/x", { a: 1 });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api/x",
      expect.objectContaining({
        method: method.toUpperCase(),
        body: '{"a":1}',
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("sends no body when there is none", async () => {
    const fetchMock = stubFetch();

    await new ApiClient("http://api").post("/x");

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: {}, body: undefined });
  });

  it("returns nothing for a response without content", async () => {
    stubFetch({ ok: true, status: 204 });

    await expect(new ApiClient("http://api").delete("/x")).resolves.toBeUndefined();
  });

  it("sends the access token of the provider", async () => {
    const fetchMock = stubFetch();
    ApiClient.setTokenProvider(() => "token");

    await new ApiClient("http://api").get("/x");

    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer token" });
  });
});
