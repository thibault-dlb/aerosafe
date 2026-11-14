import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Pill from "./Pill";

describe("Pill", () => {
  it("always shows its word", () => {
    render(<Pill tone="active">En cours</Pill>);

    expect(screen.getByText("En cours")).toBeInTheDocument();
  });

  it("draws a check for a finished item and a dot for the others", () => {
    const done = render(<Pill tone="done">Traitée</Pill>);
    expect(done.container.querySelector("svg")).not.toBeNull();
    expect(done.container.querySelector("i")).toBeNull();
    done.unmount();

    const open = render(<Pill tone="open">Non traitée</Pill>);
    expect(open.container.querySelector("i")).not.toBeNull();
    expect(open.container.querySelector("svg")).toBeNull();
  });

  it("is neutral by default", () => {
    const { container } = render(<Pill>Terminée</Pill>);

    expect(container.firstChild).toHaveClass(/neutral/);
  });
});
