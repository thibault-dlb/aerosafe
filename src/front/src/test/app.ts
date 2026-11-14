import { type RenderOptions, render } from "@testing-library/react";
import { type ReactElement, type ReactNode, createElement } from "react";
import { MemoryRouter } from "react-router-dom";

import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import PreferencesProvider from "@/providers/PreferencesProvider";
import ToastProvider from "@/providers/ToastProvider";
import { PreferenceStore } from "@/services/PreferenceStore";
import { fakeSession } from "@/test/auth";

/** The choices a test starts with, by storage key: `{ "aerosafe.units": "aeronautical" }`. */
export type StoredPreferences = Record<string, string>;

export interface AppRenderOptions extends Omit<RenderOptions, "wrapper"> {
  preferences?: StoredPreferences;
  /** Where the router starts. */
  path?: string;
  /** Who is logged in. By default a User. */
  session?: AuthContextValue;
}

/**
 * Renders a page the way the application does: with the preferences (French by default), the
 * floating notifications, a session and a router. For the pages and the components that need them.
 */
export function renderInApp(ui: ReactElement, options: AppRenderOptions = {}) {
  const { preferences = {}, path = "/", session = fakeSession("authenticated", "USER"), ...renderOptions } = options;
  const values = new Map(Object.entries(preferences));
  const store = new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(PreferencesProvider, {
      store,
      children: createElement(
        AuthContext.Provider,
        { value: session },
        createElement(ToastProvider, null, createElement(MemoryRouter, { initialEntries: [path] }, children)),
      ),
    });
  return render(ui, { wrapper, ...renderOptions });
}
