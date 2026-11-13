import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import PreferencesProvider from "@/providers/PreferencesProvider";
import type { LiveOverviewService } from "@/services/LiveOverviewService";
import { PreferenceStore } from "@/services/PreferenceStore";

import Dashboard from "./Dashboard";

function memoryStore(): PreferenceStore {
  const values = new Map<string, string>();
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

const SERVICE = {
  load: vi.fn().mockResolvedValue({
    aircraft: { state: "unauthenticated" },
    activeAlerts: { state: "unauthenticated" },
    dayAlerts: { state: "unauthenticated" },
  }),
} as unknown as LiveOverviewService;

async function renderDashboard() {
  render(
    <PreferencesProvider store={memoryStore()}>
      <MemoryRouter>
        <Dashboard overview={SERVICE} />
      </MemoryRouter>
    </PreferencesProvider>,
  );
  await act(async () => {});
}

describe("Dashboard", () => {
  it("shows its title", async () => {
    await renderDashboard();

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("shows the live overview, which invites a visitor to log in", async () => {
    await renderDashboard();

    expect(screen.getByText("Connectez-vous pour voir le trafic en direct.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/login");
  });
});
