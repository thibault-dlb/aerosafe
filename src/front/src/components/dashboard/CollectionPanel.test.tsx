import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CollectionRun, CollectionSummary } from "@/models/Dashboard";
import { renderInApp } from "@/test/app";

import CollectionPanel from "./CollectionPanel";

const T0 = new Date("2026-11-14T10:00:00Z");

function summary(overrides: Partial<{ enabled: boolean; paused: boolean; running: boolean }> = {}) {
  const { enabled = true, paused = false, running = false } = overrides;
  return new CollectionSummary(enabled, paused, running, T0, 3900, [new CollectionRun(T0, "SUCCESS"), new CollectionRun(T0, "FAILED")]);
}

const ACTIONS = { onPause: vi.fn(), onResume: vi.fn(), onRun: vi.fn() };

describe("CollectionPanel", () => {
  it.each([
    [{}, "Active"],
    [{ paused: true }, "En pause"],
    [{ running: true }, "En cours"],
    [{ enabled: false }, "Désactivée"],
  ])("says the state of %j: %s", (state, text) => {
    renderInApp(<CollectionPanel collection={summary(state)} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("shows the last success, the credits and the history", () => {
    renderInApp(<CollectionPanel collection={summary()} />);

    expect(screen.getByText("3900")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByLabelText(/Cycle de .* : (réussi|échoué)/)).toHaveLength(2);
  });

  it("knows nothing before the first run", () => {
    renderInApp(<CollectionPanel collection={new CollectionSummary(true, false, false, null, null, [])} />);

    expect(screen.getByText("Aucun")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("has no control without the actions", () => {
    renderInApp(<CollectionPanel collection={summary()} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("pauses and runs for the Supervisor", () => {
    renderInApp(<CollectionPanel collection={summary()} {...ACTIONS} />);

    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Lancer maintenant" }));

    expect(ACTIONS.onPause).toHaveBeenCalled();
    expect(ACTIONS.onRun).toHaveBeenCalled();
  });

  it("resumes a paused collection", () => {
    renderInApp(<CollectionPanel collection={summary({ paused: true })} {...ACTIONS} />);

    fireEvent.click(screen.getByRole("button", { name: "Reprendre" }));

    expect(ACTIONS.onResume).toHaveBeenCalled();
  });

  it("waits while an action runs or the collection itself runs", () => {
    const { unmount } = renderInApp(<CollectionPanel collection={summary()} {...ACTIONS} busy />);
    expect(screen.getByRole("button", { name: "Lancer maintenant" })).toBeDisabled();
    unmount();

    renderInApp(<CollectionPanel collection={summary({ running: true })} {...ACTIONS} />);
    expect(screen.getByRole("button", { name: "Lancer maintenant" })).toBeDisabled();
  });

  it("offers no control when the collection is disabled on this instance", () => {
    renderInApp(<CollectionPanel collection={summary({ enabled: false })} {...ACTIONS} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
