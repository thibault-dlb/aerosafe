import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AircraftMap from "./AircraftMap";

describe("AircraftMap", () => {
  it("names the number of aircraft it shows", () => {
    render(<AircraftMap aircraft={[{ latitude: 48.85, longitude: 2.35 }]} />);

    expect(screen.getByRole("img", { name: "Map of 1 aircraft" })).toBeInTheDocument();
  });
});
