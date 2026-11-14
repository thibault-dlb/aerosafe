import { type RenderOptions, render } from "@testing-library/react";
import { type ReactElement, type ReactNode, createElement } from "react";
import { MemoryRouter } from "react-router-dom";

import PreferencesProvider from "@/providers/PreferencesProvider";
import ToastProvider from "@/providers/ToastProvider";
import { PreferenceStore } from "@/services/PreferenceStore";

/** The choices a test starts with, by storage key: `{ "aerosafe.units": "aeronautical" }`. */
export type StoredPreferences = Record<string, string>;

export interface AppRenderOptions extends Omit<RenderOptions, "wrapper"> {
  preferences?: StoredPreferences;
  /** Where the router starts. */
  path?: string;
}

/**
 * Renders a page the way the application does: with the preferences (French by default), the
 * floating notifications and a router. For the pages and the components that need all three.
 */
export function renderInApp(ui: ReactElement, options: AppRenderOptions = {}) {
  const { preferences = {}, path = "/", ...renderOptions } = options;
  const values = new Map(Object.entries(preferences));
  const store = new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(PreferencesProvider, {
      store,
      children: createElement(ToastProvider, null, createElement(MemoryRouter, { initialEntries: [path] }, children)),
    });
  return render(ui, { wrapper, ...renderOptions });
}
