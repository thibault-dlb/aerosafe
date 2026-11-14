import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
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
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();
  return (
    <>
      <p>{`${language}/${theme}`}</p>
      <p>{t("nav.alerts")}</p>
      <button onClick={() => setLanguage("en")}>english</button>
      <button onClick={() => setTheme("light")}>light</button>
    </>
  );
}

describe("PreferencesProvider", () => {
  it("starts in French with the dark theme", () => {
    render(<Probe />, { wrapper: wrapperWith(memoryStore()) });

    expect(screen.getByText("fr/dark")).toBeInTheDocument();
    expect(screen.getByText("Alertes")).toBeInTheDocument();
  });

  it("switches the language and the theme", () => {
    render(<Probe />, { wrapper: wrapperWith(memoryStore()) });

    fireEvent.click(screen.getByText("english"));
    fireEvent.click(screen.getByText("light"));

    expect(screen.getByText("en/light")).toBeInTheDocument();
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.lang).toBe("en");
  });

  it("keeps the choices for the next visit", () => {
    const store = memoryStore();
    const first = render(<Probe />, { wrapper: wrapperWith(store) });
    fireEvent.click(screen.getByText("english"));
    first.unmount();

    render(<Probe />, { wrapper: wrapperWith(store) });

    expect(screen.getByText("en/dark")).toBeInTheDocument();
  });

  it("switches the units and keeps the choice for the next visit", () => {
    const store = memoryStore();
    const { result, unmount } = renderHook(() => usePreferences(), { wrapper: wrapperWith(store) });
    expect(result.current.units).toBe("metric");

    act(() => result.current.setUnits("aeronautical"));
    expect(result.current.units).toBe("aeronautical");
    unmount();

    const next = renderHook(() => usePreferences(), { wrapper: wrapperWith(store) });
    expect(next.result.current.units).toBe("aeronautical");
  });

  it("refuses to be used outside the provider", () => {
    expect(() => renderHook(() => useTranslation())).toThrow("PreferencesProvider");
  });
});
