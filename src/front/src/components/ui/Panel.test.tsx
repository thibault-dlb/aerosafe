import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Panel from "./Panel";

describe("Panel", () => {
  it("shows its heading and its content", () => {
    render(
      <Panel title="Live flights">
        <p>Content</p>
      </Panel>,
    );

    expect(screen.getByRole("heading", { name: "Live flights" })).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("is a named region when it has a heading", () => {
    render(<Panel title="Live flights">x</Panel>);

    expect(screen.getByRole("region", { name: "Live flights" })).toBeInTheDocument();
  });

  it("works without a heading", () => {
    render(<Panel>Only content</Panel>);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Only content")).toBeInTheDocument();
  });
});
