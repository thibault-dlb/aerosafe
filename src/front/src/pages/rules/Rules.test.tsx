import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Rules from "./Rules";

describe("Rules", () => {
  it("shows its title", () => {
    render(<Rules />);

    expect(screen.getByRole("heading", { name: "Rules" })).toBeInTheDocument();
  });
});
