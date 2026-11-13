import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Button, { ButtonLink } from "./Button";

describe("Button", () => {
  it("is a button that does not submit a form by default", () => {
    render(<Button>Filter</Button>);

    expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("type", "button");
  });

  it("calls its handler", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);

    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("can be disabled", () => {
    render(<Button disabled>Go</Button>);

    expect(screen.getByRole("button", { name: "Go" })).toBeDisabled();
  });

  it("accepts a variant and an extra class", () => {
    render(
      <Button variant="danger" className="extra">
        Delete
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("extra");
  });
});

describe("ButtonLink", () => {
  it("is a link to a page of the application", () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/aircraft" variant="secondary">
          Search
        </ButtonLink>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/aircraft");
  });
});
