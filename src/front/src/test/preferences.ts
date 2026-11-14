import { type RenderOptions, render } from "@testing-library/react";
import { type ReactElement, type ReactNode, createElement } from "react";

import PreferencesProvider from "@/providers/PreferencesProvider";
import { PreferenceStore } from "@/services/PreferenceStore";

/** The preferences of the application (French, dark, metric) without any browser storage. */
function wrapper({ children }: { children: ReactNode }) {
  return createElement(PreferencesProvider, { store: new PreferenceStore(null) }, children);
}

/** Renders a component that reads the preferences, for example to translate its texts. */
export function renderWithPreferences(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper, ...options });
}
