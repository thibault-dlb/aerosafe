import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Notice from "./Notice";

describe("Notice", () => {
  it("is a status for information", () => {
    render(<Notice>Saved</Notice>);

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it.each(["warning", "danger"] as const)("is an alert for the %s variant", (variant) => {
    render(<Notice variant={variant}>Problem</Notice>);

    expect(screen.getByRole("alert")).toHaveTextContent("Problem");
  });

  it("accepts an extra class", () => {
    render(<Notice className="extra">x</Notice>);

    expect(screen.getByRole("status")).toHaveClass("extra");
  });
});
