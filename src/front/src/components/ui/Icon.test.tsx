import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Icon from "./Icon";
import { IconSet } from "./IconSet";

describe("Icon", () => {
  it("is decoration by default: hidden from screen readers", () => {
    const { container } = render(<Icon name="mail" />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("can be named for screen readers", () => {
    render(<Icon name="alert" label="Warning" />);

    expect(screen.getByRole("img", { name: "Warning" })).not.toHaveAttribute("aria-hidden");
  });

  it("takes a size and a class", () => {
    const { container } = render(<Icon name="lock" size={18} className="extra" />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveStyle({ width: "18px", height: "18px" });
    expect(svg).toHaveClass("extra");
  });

  it("draws every icon of the set with at least one shape", () => {
    for (const name of IconSet.names()) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelectorAll("path, circle, rect").length, name).toBeGreaterThan(0);
      unmount();
    }
  });

  it("draws the three kinds of shape, and fills the solid ones", () => {
    const { container } = render(
      <>
        <Icon name="dashboard" />
        <Icon name="aircraft" />
        <Icon name="alert" />
      </>,
    );

    expect(container.querySelector("rect")).not.toBeNull();
    expect(container.querySelector("path[transform]")).not.toBeNull();
    expect(container.querySelector("circle")?.getAttribute("class")).toMatch(/solid/);
  });

  it("offers the 44 icons of the design", () => {
    expect(IconSet.names()).toHaveLength(44);
    expect(IconSet.names()).toEqual(
      expect.arrayContaining(["dashboard", "eyeOff", "capsLock", "replay", "ruleR1", "ruleR5", "anonymous", "table"]),
    );
  });

  it("draws dashed shapes where the design asks for them", () => {
    const { container } = render(
      <>
        <Icon name="area" />
        <Icon name="ruleR5" />
      </>,
    );

    expect(container.querySelector("rect")).toHaveAttribute("stroke-dasharray", "3 3");
    expect(container.querySelector("path[stroke-dasharray]")).not.toBeNull();
  });
});
