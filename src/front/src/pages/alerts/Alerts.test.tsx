import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Alerts from "./Alerts";

describe("Alerts", () => {
  it("shows its title", () => {
    render(<Alerts />);

    expect(screen.getByRole("heading", { name: "Alerts" })).toBeInTheDocument();
  });
});
