import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Alert } from "@/models/Alert";

import AlertTable from "./AlertTable";

describe("AlertTable", () => {
  it("shows one row per alert", () => {
    render(<AlertTable alerts={[new Alert("1", "R1", new Date("2026-11-07T10:00:00Z"), "Silent")]} />);

    expect(screen.getByRole("cell", { name: "R1" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Silent" })).toBeInTheDocument();
  });
});
