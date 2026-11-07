import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AircraftRecord from "./AircraftRecord";

describe("AircraftRecord", () => {
  it("shows its title", () => {
    render(<AircraftRecord />);

    expect(screen.getByRole("heading", { name: "Aircraft record" })).toBeInTheDocument();
  });
});
