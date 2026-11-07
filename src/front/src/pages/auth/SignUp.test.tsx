import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SignUp from "./SignUp";

describe("SignUp", () => {
  it("shows its title", () => {
    render(<SignUp />);

    expect(screen.getByRole("heading", { name: "Sign up" })).toBeInTheDocument();
  });
});
