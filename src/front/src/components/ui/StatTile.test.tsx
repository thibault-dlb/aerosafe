import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatTile from "./StatTile";

describe("StatTile", () => {
  it("shows the label and the value", () => {
    render(<StatTile label="Tracked aircraft" value={42} />);

    expect(screen.getByText("Tracked aircraft")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows the hint when there is one", () => {
    render(<StatTile label="Alerts" value="3" hint="last 24 h" />);

    expect(screen.getByText("last 24 h")).toBeInTheDocument();
  });
});
