import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./Home";

describe("Home", () => {
  it("shows the application name", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "AeroSafe" })).toBeInTheDocument();
  });
});
