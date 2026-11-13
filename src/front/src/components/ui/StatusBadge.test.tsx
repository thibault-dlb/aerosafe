import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatusBadge from "./StatusBadge";

describe("StatusBadge", () => {
  it.each(["normal", "warning", "danger"] as const)("shows the label of the %s level", (level) => {
    render(<StatusBadge level={level} label="In flight" />);

    expect(screen.getByText("In flight")).toBeInTheDocument();
  });
});
