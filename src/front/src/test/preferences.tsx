import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import PreferencesProvider from "@/providers/PreferencesProvider";
import { PreferenceStore } from "@/services/PreferenceStore";

/** The preferences of the application (French, dark, metric) without any browser storage. */
function PreferencesWrapper({ children }: { children: ReactNode }) {
  return <PreferencesProvider store={new PreferenceStore(null)}>{children}</PreferencesProvider>;
}

/** Renders a component that reads the preferences, for example to translate its texts. */
export function renderWithPreferences(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper: PreferencesWrapper, ...options });
}
