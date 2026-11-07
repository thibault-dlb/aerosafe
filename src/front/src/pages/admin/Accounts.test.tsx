import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Accounts from "./Accounts";

describe("Accounts", () => {
  it("shows its title", () => {
    render(<Accounts />);

    expect(screen.getByRole("heading", { name: "Accounts" })).toBeInTheDocument();
  });
});
