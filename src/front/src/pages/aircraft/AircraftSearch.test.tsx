import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AircraftSearch from "./AircraftSearch";

describe("AircraftSearch", () => {
  it("shows its title", () => {
    render(<AircraftSearch />);

    expect(screen.getByRole("heading", { name: "Aircraft search" })).toBeInTheDocument();
  });
});
