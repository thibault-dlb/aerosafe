import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FlightDetail from "./FlightDetail";

describe("FlightDetail", () => {
  it("shows its title", () => {
    render(<FlightDetail />);

    expect(screen.getByRole("heading", { name: "Flight" })).toBeInTheDocument();
  });
});
