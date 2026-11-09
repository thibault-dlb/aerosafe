import { describe, expect, it, vi } from "vitest";

import type { RuleJson } from "@/models/Rule";
import { ApiClient } from "@/services/ApiClient";

import { RuleService } from "./RuleService";

const R1: RuleJson = {
  code: "R1",
  description: "Délai trop long depuis le dernier contact",
  threshold: 300,
  unit: "s",
  criticality: "MEDIUM",
  is_active: true,
  updated_at: "2026-11-09T10:00:00Z",
};

describe("RuleService", () => {
  it("lists the rules", async () => {
    const get = vi.fn().mockResolvedValue([R1]);
    const service = new RuleService({ get } as unknown as ApiClient);

    const [rule] = await service.list();

    expect(get).toHaveBeenCalledWith("/v1/rules");
    expect(rule.threshold).toBe(300);
    expect(rule.isActive).toBe(true);
    expect(rule.updatedAt).toEqual(new Date("2026-11-09T10:00:00Z"));
  });

  it("sends only the changed settings", async () => {
    const patch = vi.fn().mockResolvedValue({ ...R1, threshold: 420, criticality: null });
    const service = new RuleService({ patch } as unknown as ApiClient);

    const rule = await service.update("R1", { threshold: 420, criticality: null });

    expect(patch).toHaveBeenCalledWith("/v1/rules/R1", { threshold: 420, criticality: null });
    expect(rule.threshold).toBe(420);
    expect(rule.criticality).toBeNull();
  });
});
