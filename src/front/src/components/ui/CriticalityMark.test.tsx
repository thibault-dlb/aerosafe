import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithPreferences } from "@/test/preferences";

import CriticalityMark from "./CriticalityMark";

describe("CriticalityMark", () => {
  it.each([
    ["HIGH", "Criticité Haute"],
    ["MEDIUM", "Criticité Moyenne"],
    ["LOW", "Criticité Basse"],
    [null, "Criticité Aucune"],
  ] as const)("names the %s mark for screen readers", (level, name) => {
    renderWithPreferences(<CriticalityMark level={level} />);

    expect(screen.getByRole("img", { name })).toBeInTheDocument();
  });

  it("draws a different shape for each level, so the colour is never the only clue", () => {
    const shapes = (["HIGH", "MEDIUM", "LOW", null] as const).map((level) => {
      const { container, unmount } = renderWithPreferences(<CriticalityMark level={level} />);
      const shape = container.querySelector("path, circle");
      const signature = `${shape?.tagName}:${shape?.getAttribute("d") ?? ""}`;
      unmount();
      return signature;
    });

    expect(new Set(shapes).size).toBe(4);
  });

  it("shows the word beside the shape, and then does not repeat the name", () => {
    renderWithPreferences(<CriticalityMark level="HIGH" variant="label" />);

    expect(screen.getByText("Haute")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("can be a badge", () => {
    const { container } = renderWithPreferences(<CriticalityMark level="MEDIUM" variant="badge" className="extra" />);

    expect(screen.getByText("Moyenne")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("extra");
  });
});
