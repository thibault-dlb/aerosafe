import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "@/services/ApiClient";

import { CollectionService } from "./CollectionService";

describe("CollectionService", () => {
  it.each([
    ["pause", "/v1/collection/pause"],
    ["resume", "/v1/collection/resume"],
    ["runNow", "/v1/collection/run"],
  ] as const)("%s posts to %s", async (method, path) => {
    const post = vi.fn().mockResolvedValue({});

    await new CollectionService({ post } as unknown as ApiClient)[method]();

    expect(post).toHaveBeenCalledWith(path);
  });
});
