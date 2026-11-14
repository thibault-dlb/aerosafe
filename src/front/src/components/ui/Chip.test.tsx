import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Chip from "./Chip";

describe("Chip", () => {
  it("tells whether the filter is on", () => {
    const { rerender } = render(<Chip pressed={false}>Non traitées</Chip>);
    expect(screen.getByRole("button", { name: "Non traitées" })).toHaveAttribute("aria-pressed", "false");

    rerender(<Chip pressed>Non traitées</Chip>);
    expect(screen.getByRole("button", { name: "Non traitées" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the number of results behind the filter, only when given", () => {
    const { rerender } = render(<Chip pressed>Actives</Chip>);
    expect(screen.queryByText("3")).not.toBeInTheDocument();

    rerender(
      <Chip pressed count={3}>
        Actives
      </Chip>,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("is not a submit button, and reports its clicks", () => {
    const onClick = vi.fn();
    render(
      <Chip pressed={false} onClick={onClick}>
        Hautes
      </Chip>,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
    expect(onClick).toHaveBeenCalledOnce();
  });
});
