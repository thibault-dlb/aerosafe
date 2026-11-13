import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { useDataMode } from "@/hooks/useDataMode";
import { DataModeService } from "@/services/DataModeService";
import { PreferenceStore } from "@/services/PreferenceStore";

import PreferencesProvider from "./PreferencesProvider";

function memoryStore(): PreferenceStore {
  const values = new Map<string, string>();
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

function wrapperWith(store: PreferenceStore) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <PreferencesProvider store={store}>{children}</PreferencesProvider>;
  };
}

function Probe() {
  const { mode, setMode } = useDataMode();
  return (
    <>
      <p data-testid="mode">{mode}</p>
      <button onClick={() => setMode("replay")}>choose the replay</button>
      <button onClick={() => setMode("live")}>choose the live data</button>
    </>
  );
}

afterEach(() => DataModeService.reset());

describe("PreferencesProvider data mode", () => {
  it("shows the live data by default", () => {
    render(<Probe />, { wrapper: wrapperWith(memoryStore()) });

    expect(screen.getByTestId("mode")).toHaveTextContent("live");
  });

  it("switches to the replay and back, and tells the services that read the mode", () => {
    const store = memoryStore();
    render(<Probe />, { wrapper: wrapperWith(store) });

    fireEvent.click(screen.getByText("choose the replay"));
    expect(screen.getByTestId("mode")).toHaveTextContent("replay");
    expect(new DataModeService(store).isReplay()).toBe(true);

    fireEvent.click(screen.getByText("choose the live data"));
    expect(screen.getByTestId("mode")).toHaveTextContent("live");
    expect(new DataModeService(store).isReplay()).toBe(false);
  });

  it("keeps the mode for the next visit", () => {
    const store = memoryStore();
    const first = render(<Probe />, { wrapper: wrapperWith(store) });
    fireEvent.click(screen.getByText("choose the replay"));
    first.unmount();
    DataModeService.reset();

    render(<Probe />, { wrapper: wrapperWith(store) });

    expect(store.get(DataModeService.KEY)).toBe("replay");
    expect(screen.getByTestId("mode")).toHaveTextContent("replay");
  });
});
