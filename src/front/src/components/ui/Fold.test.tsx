import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Fold from "./Fold";

describe("Fold", () => {
  it("shows its content when open", () => {
    render(
      <Fold open>
        <button>Inside</button>
      </Fold>,
    );

    expect(screen.getByRole("button", { name: "Inside" })).toBeVisible();
  });

  it("hides its content from the keyboard and from screen readers when closed", () => {
    const { container } = render(
      <Fold open={false}>
        <button>Inside</button>
      </Fold>,
    );

    expect(screen.queryByRole("button", { name: "Inside" })).not.toBeInTheDocument();
    expect(container.querySelector("[inert]")).not.toBeNull();
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});
