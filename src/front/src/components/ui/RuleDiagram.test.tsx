import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithPreferences } from "@/test/preferences";

import RuleDiagram from "./RuleDiagram";

describe("RuleDiagram", () => {
  it.each(["R1", "R2", "R3", "R4", "R5"])("draws and names the diagram of %s", (code) => {
    const { container } = renderWithPreferences(<RuleDiagram code={code} />);

    expect(screen.getByRole("img", { name: `Schéma de la règle ${code}` })).toBeInTheDocument();
    expect(container.querySelectorAll("path").length).toBeGreaterThan(3);
  });

  it("always shows where the threshold falls", () => {
    for (const code of ["R1", "R2", "R3", "R4", "R5"]) {
      const { unmount } = renderWithPreferences(<RuleDiagram code={code} />);
      expect(screen.getAllByText(/seuil|pente seuil|virage au seuil/).length, code).toBeGreaterThan(0);
      unmount();
    }
  });

  it("tells silence from stale positions", () => {
    const silence = renderWithPreferences(<RuleDiagram code="R1" />);
    expect(screen.getByText("silence")).toBeInTheDocument();
    silence.unmount();

    renderWithPreferences(<RuleDiagram code="R2" />);
    expect(screen.getByText("positions")).toBeInTheDocument();
    expect(screen.getByText("messages (continus)")).toBeInTheDocument();
  });

  it("labels the altitude of R3 and the speed of R4", () => {
    const altitude = renderWithPreferences(<RuleDiagram code="R3" />);
    expect(screen.getByText("altitude")).toBeInTheDocument();
    altitude.unmount();

    renderWithPreferences(<RuleDiagram code="R4" />);
    expect(screen.getByText("vitesse")).toBeInTheDocument();
  });

  it("draws nothing for a rule added later", () => {
    const { container } = renderWithPreferences(<RuleDiagram code="R9" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("takes a class", () => {
    renderWithPreferences(<RuleDiagram code="R1" className="extra" />);

    expect(screen.getByRole("img")).toHaveClass("extra");
  });
});
