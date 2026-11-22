import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "@/services/ApiClient";

import { CollectionService } from "./CollectionService";

describe("CollectionService", () => {
  it.each([
    ["pause", "/v1/collection/pause"],
    ["resume", "/v1/collection/resume"],
    ["runNow", "/v1/collection/run"],
  ] as const)("%s posts to %s for OpenSky by default", async (method, path) => {
    const post = vi.fn().mockResolvedValue({});

    await new CollectionService({ post } as unknown as ApiClient)[method]();

    expect(post).toHaveBeenCalledWith(`${path}?source=opensky`);
  });

  it("acts on the source asked", async () => {
    const post = vi.fn().mockResolvedValue({});

    await new CollectionService({ post } as unknown as ApiClient).pause("adsbfi");

    expect(post).toHaveBeenCalledWith("/v1/collection/pause?source=adsbfi");
  });
});
