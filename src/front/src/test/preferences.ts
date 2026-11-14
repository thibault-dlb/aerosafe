import { type RenderOptions, render } from "@testing-library/react";
import { type ReactElement, type ReactNode, createElement } from "react";

import PreferencesProvider from "@/providers/PreferencesProvider";
import { PreferenceStore } from "@/services/PreferenceStore";

/** The choices a test starts with, by storage key: `{ "aerosafe.units": "aeronautical" }`. */
export type StoredPreferences = Record<string, string>;

function storeOf(preferences: StoredPreferences): PreferenceStore {
  const values = new Map(Object.entries(preferences));
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

/** The preferences of the application (French, dark, metric) without any browser storage. */
export function withPreferences({ children }: { children: ReactNode }) {
  return createElement(PreferencesProvider, { store: new PreferenceStore(null), children });
}

/** Renders a component that reads the preferences, for example to translate its texts. */
export function renderWithPreferences(
  ui: ReactElement,
  options: Omit<RenderOptions, "wrapper"> & { preferences?: StoredPreferences } = {},
) {
  const { preferences = {}, ...renderOptions } = options;
  const store = storeOf(preferences);
  const wrapper = ({ children }: { children: ReactNode }) => createElement(PreferencesProvider, { store, children });
  return render(ui, { wrapper, ...renderOptions });
}
