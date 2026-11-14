import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { withPreferences } from "@/test/preferences";

import Breadcrumb from "./Breadcrumb";

function renderTrail() {
  render(
    <MemoryRouter>
      <Breadcrumb
        items={[
          { label: "Aéronefs", to: "/aircraft" },
          { label: "F-GKXA", to: "/aircraft/1" },
          { label: "Vol AFR1234" },
        ]}
      />
    </MemoryRouter>,
    { wrapper: withPreferences },
  );
}

describe("Breadcrumb", () => {
  it("is a navigation with a link for each step up", () => {
    renderTrail();

    expect(screen.getByRole("navigation", { name: "Fil d'Ariane" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aéronefs" })).toHaveAttribute("href", "/aircraft");
    expect(screen.getByRole("link", { name: "F-GKXA" })).toHaveAttribute("href", "/aircraft/1");
  });

  it("shows the page itself as the current step, without a link", () => {
    renderTrail();

    expect(screen.getByText("Vol AFR1234")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Vol AFR1234" })).not.toBeInTheDocument();
  });
});
