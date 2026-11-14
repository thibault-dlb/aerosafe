import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AircraftBanner from "./AircraftBanner";

describe("AircraftBanner", () => {
  it("is headed by the name, with its subtitle", () => {
    render(<AircraftBanner title="F-GKXA" subtitle="Airbus A320 · Air France" />);

    expect(screen.getByRole("heading", { level: 1, name: "F-GKXA" })).toBeInTheDocument();
    expect(screen.getByText("Airbus A320 · Air France")).toBeInTheDocument();
  });

  it("shows the badges, the route and the figures it is given", () => {
    render(
      <AircraftBanner title="AFR1234" badges={<span>En vol</span>} route={<span>LFPG → LFMN</span>}>
        <p>42 min</p>
      </AircraftBanner>,
    );

    expect(screen.getByText("En vol")).toBeInTheDocument();
    expect(screen.getByText("LFPG → LFMN")).toBeInTheDocument();
    expect(screen.getByText("42 min")).toBeInTheDocument();
  });

  it("leaves out what it is not given", () => {
    const { container } = render(<AircraftBanner title="3C6444" />);

    expect(container.querySelectorAll("p, div > div")).toHaveLength(0);
  });
});
