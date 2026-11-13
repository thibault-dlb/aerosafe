import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Table from "./Table";

describe("Table", () => {
  it("shows a table with its caption and rows", () => {
    render(
      <Table>
        <caption>Aircraft</caption>
        <thead>
          <tr>
            <th scope="col">Callsign</th>
          </tr>
        </thead>
        <tbody>
          <tr aria-selected="true">
            <td>AFR123</td>
          </tr>
        </tbody>
      </Table>,
    );

    expect(screen.getByRole("table", { name: "Aircraft" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Callsign" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "AFR123" })).toBeInTheDocument();
  });
});
