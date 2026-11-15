import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Aircraft } from "@/models/Aircraft";
import { renderInApp } from "@/test/app";

import { FindAircraft, MapTools, SUGGESTIONS } from "./MapTools";

const NOW = new Date("2026-11-14T10:00:00Z");
const FLEET = [
  new Aircraft("01A", "3c6444", "F-GKXA", null, null, NOW, 48.8, 2.3),
  new Aircraft("01B", "4b1814", null, null, null, NOW, 47, 3),
];

describe("MapTools", () => {
  it("recentres, goes full screen and zooms", () => {
    const actions = { onRecenter: vi.fn(), onFullscreen: vi.fn(), onZoom: vi.fn() };
    renderInApp(<MapTools fullscreen={false} {...actions} />);

    fireEvent.click(screen.getByRole("button", { name: "Recentrer sur la zone" }));
    fireEvent.click(screen.getByRole("button", { name: "Plein écran" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoomer" }));
    fireEvent.click(screen.getByRole("button", { name: "Dézoomer" }));

    expect(actions.onRecenter).toHaveBeenCalledTimes(1);
    expect(actions.onFullscreen).toHaveBeenCalledTimes(1);
    expect(actions.onZoom).toHaveBeenNthCalledWith(1, 0.75);
    expect(actions.onZoom).toHaveBeenNthCalledWith(2, -0.75);
  });

  it("offers to leave the full screen when it is on", () => {
    renderInApp(<MapTools fullscreen onRecenter={vi.fn()} onFullscreen={vi.fn()} onZoom={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Quitter le plein écran" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("FindAircraft", () => {
  it("finds an aircraft by registration or by address, whatever the case", () => {
    const onFind = vi.fn();
    renderInApp(<FindAircraft aircraft={FLEET} onFind={onFind} />);
    const box = screen.getByRole("combobox", { name: "Suivre un aéronef" });

    fireEvent.change(box, { target: { value: "f-gkxa" } });
    fireEvent.submit(box);
    fireEvent.change(box, { target: { value: "4B1814" } });
    fireEvent.submit(box);

    expect(onFind).toHaveBeenNthCalledWith(1, FLEET[0]);
    expect(onFind).toHaveBeenNthCalledWith(2, FLEET[1]);
    expect(box).toHaveValue("");
  });

  it("says so when no aircraft has the name", () => {
    const onFind = vi.fn();
    renderInApp(<FindAircraft aircraft={FLEET} onFind={onFind} />);
    const box = screen.getByRole("combobox", { name: "Suivre un aéronef" });

    fireEvent.change(box, { target: { value: "nobody" } });
    fireEvent.submit(box);

    expect(screen.getByRole("status")).toHaveTextContent("Aucun aéronef ne porte ce nom.");
    expect(onFind).not.toHaveBeenCalled();

    fireEvent.change(box, { target: { value: "n" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not complain about an empty box", () => {
    renderInApp(<FindAircraft aircraft={FLEET} onFind={vi.fn()} />);

    fireEvent.submit(screen.getByRole("combobox", { name: "Suivre un aéronef" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("suggests the names that start like what is typed, a dozen at most", () => {
    const many = Array.from({ length: 40 }, (_, index) => new Aircraft(`0${index}`, `3c${index.toString().padStart(4, "0")}`, `F-AB${index}`, null, null, NOW, 48, 2));
    const { container } = renderInApp(<FindAircraft aircraft={many} onFind={vi.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Suivre un aéronef" }), { target: { value: "f-ab" } });

    expect(container.querySelectorAll("datalist option")).toHaveLength(SUGGESTIONS);
  });
});
