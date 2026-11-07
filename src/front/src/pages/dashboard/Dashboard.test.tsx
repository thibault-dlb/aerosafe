import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Dashboard from "./Dashboard";

describe("Dashboard", () => {
  it("shows its title", () => {
    render(<Dashboard />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });
});
