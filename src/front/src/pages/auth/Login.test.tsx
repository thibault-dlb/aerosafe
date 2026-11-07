import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Login from "./Login";

describe("Login", () => {
  it("shows its title", () => {
    render(<Login />);

    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });
});
