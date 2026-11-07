import { describe, expect, it } from "vitest";

import { MapService } from "./MapService";

describe("MapService", () => {
  it("is not implemented yet", () => {
    const service = new MapService();

    expect(() => service.mount(document.createElement("div"))).toThrow("Not implemented");
    expect(() => service.showAircraft([])).toThrow("Not implemented");
    expect(() => service.showTrajectory([])).toThrow("Not implemented");
    expect(() => service.destroy()).toThrow("Not implemented");
  });
});
