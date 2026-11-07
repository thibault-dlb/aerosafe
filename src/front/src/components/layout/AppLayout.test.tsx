import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import AppLayout from "./AppLayout";

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout />,
        children: [{ path: "/alerts", element: <h1>Page content</h1> }],
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

describe("AppLayout", () => {
  it("shows the navigation of every work package", () => {
    renderAt("/alerts");

    for (const label of ["Aircraft", "Dashboard", "Alerts", "Rules", "Accounts", "Log in"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("shows the current page", () => {
    renderAt("/alerts");

    expect(screen.getByRole("heading", { name: "Page content" })).toBeInTheDocument();
  });
});
