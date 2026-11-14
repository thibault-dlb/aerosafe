import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithPreferences } from "@/test/preferences";

import Profile, { type ProfilePoint } from "./Profile";

const T0 = Date.parse("2026-11-09T10:00:00Z");
const POINTS: ProfilePoint[] = [
  { time: T0, value: 9000 },
  { time: T0 + 30_000, value: 10000 },
  { time: T0 + 60_000, value: 10400 },
];

function chart() {
  return screen.getByRole("img", { name: "Profil : Altitude" });
}

/** jsdom lays nothing out: give the chart a width of its own so a pointer position means something. */
function lay(svg: Element) {
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 420, height: 150, right: 420, bottom: 150, x: 0, y: 0, toJSON: () => ({}) });
}

describe("Profile", () => {
  it("draws the curve, named for screen readers, with its title and unit", () => {
    const { container } = renderWithPreferences(<Profile title="Altitude" unit="m" points={POINTS} />);

    expect(chart()).toBeInTheDocument();
    expect(screen.getByText("Altitude (m)")).toBeInTheDocument();
    expect(container.querySelectorAll("path[class*=line]")).toHaveLength(1);
  });

  it("says when there are too few values to draw", () => {
    renderWithPreferences(<Profile title="Altitude" unit="m" points={POINTS.slice(0, 1)} />);

    expect(screen.getByText("Pas assez de valeurs pour tracer un profil.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("scales the axis to a round number above the largest value", () => {
    renderWithPreferences(<Profile title="Altitude" unit="m" points={POINTS} />);

    expect(screen.getByText("11000")).toBeInTheDocument();
    expect(screen.getByText("5500")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("copes with values that are all zero", () => {
    renderWithPreferences(<Profile title="Altitude" unit="m" points={POINTS.map((point) => ({ ...point, value: 0 }))} />);

    expect(chart()).toBeInTheDocument();
  });

  it("cuts the line at a gap, shades it and says it holds no data", () => {
    const points = [...POINTS, { time: T0 + 300_000, value: 10400 }, { time: T0 + 330_000, value: 10400 }];
    const { container } = renderWithPreferences(
      <Profile title="Altitude" unit="m" points={points} gaps={[{ start: T0 + 60_000, end: T0 + 300_000 }]} />,
    );

    expect(container.querySelectorAll("path[class*=line]")).toHaveLength(2);
    expect(container.querySelectorAll("rect[class*=gap]")).toHaveLength(1);
    expect(screen.getByText("sans données")).toBeInTheDocument();
  });

  it("reads the value under the pointer, and stops when it leaves", () => {
    const { container } = renderWithPreferences(<Profile title="Altitude" unit="m" points={POINTS} />);
    lay(chart());

    fireEvent.pointerMove(chart(), { clientX: 420 });
    expect(screen.getByText(/10400 m/)).toBeInTheDocument();
    expect(container.querySelector("circle")).not.toBeNull();

    fireEvent.pointerMove(chart(), { clientX: 0 });
    expect(screen.getByText(/9000 m/)).toBeInTheDocument();

    fireEvent.pointerLeave(chart());
    expect(screen.queryByText(/9000 m/)).not.toBeInTheDocument();
    expect(container.querySelector("circle")).toBeNull();
  });

  it("ignores a pointer over a chart that has no size", () => {
    renderWithPreferences(<Profile title="Altitude" unit="m" points={POINTS} />);

    fireEvent.pointerMove(chart(), { clientX: 100 });

    expect(screen.queryByText(/ m$/)).not.toBeInTheDocument();
  });
});
