import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Switch from "./Switch";

describe("Switch", () => {
  it("is a switch named by its label, on or off", () => {
    const { rerender } = render(
      <Switch checked={false} onChange={() => undefined}>
        R1 évaluée
      </Switch>,
    );
    expect(screen.getByRole("switch", { name: "R1 évaluée" })).toHaveAttribute("aria-checked", "false");

    rerender(
      <Switch checked onChange={() => undefined}>
        R1 évaluée
      </Switch>,
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("asks for the opposite value when flipped", () => {
    const onChange = vi.fn();
    render(
      <Switch checked onChange={onChange}>
        Actif
      </Switch>,
    );

    fireEvent.click(screen.getByRole("switch"));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does nothing when disabled", () => {
    const onChange = vi.fn();
    render(
      <Switch checked={false} onChange={onChange} disabled>
        Verrouillé
      </Switch>,
    );

    fireEvent.click(screen.getByRole("switch"));

    expect(onChange).not.toHaveBeenCalled();
  });
});
