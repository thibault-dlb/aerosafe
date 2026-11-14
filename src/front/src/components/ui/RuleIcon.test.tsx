import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IconSet } from "./IconSet";
import RuleIcon from "./RuleIcon";

function pathOf(code: string): string {
  const { container } = render(<RuleIcon code={code} />);
  return container.querySelector("path")?.getAttribute("d") ?? "";
}

describe("RuleIcon", () => {
  it("draws a different pictogram for each of the five rules", () => {
    const drawings = ["R1", "R2", "R3", "R4", "R5"].map(pathOf);

    expect(new Set(drawings).size).toBe(5);
  });

  it("uses the icons of the set", () => {
    const [first] = IconSet.shapes("ruleR3");

    expect(first.tag === "path" && pathOf("R3")).toBe(first.tag === "path" ? first.d : "");
  });

  it("falls back on the generic rules icon for a rule added later", () => {
    const [first] = IconSet.shapes("rules");

    expect(pathOf("R9")).toBe(first.tag === "path" ? first.d : "");
  });

  it("takes a size and a class", () => {
    const { container } = render(<RuleIcon code="R1" size={20} className="extra" />);

    expect(container.querySelector("svg")).toHaveClass("extra");
    expect(container.querySelector("svg")).toHaveStyle({ width: "20px" });
  });
});
