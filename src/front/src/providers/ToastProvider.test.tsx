import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToast } from "@/hooks/useToast";
import { withPreferences } from "@/test/preferences";

import ToastProvider, { ERROR_MS, MAX_TOASTS, SUCCESS_MS } from "./ToastProvider";

function wrapper({ children }: { children: ReactNode }) {
  return withPreferences({ children: createElement(ToastProvider, null, children) });
}

function Outside() {
  useToast();
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ToastProvider", () => {
  it("shows a notification, then takes it away after a few seconds", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => void result.current.notify({ message: "Règle R3 enregistrée." }));
    expect(screen.getByRole("status")).toHaveTextContent("Règle R3 enregistrée.");

    act(() => void vi.advanceTimersByTime(SUCCESS_MS - 1));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps an error, and a notification with an action, longer", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => void result.current.notify({ message: "Échec", tone: "error" }));
    act(() => void result.current.notify({ message: "Fait", action: { label: "Annuler", onAction: () => undefined } }));
    act(() => void vi.advanceTimersByTime(SUCCESS_MS));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(ERROR_MS - SUCCESS_MS));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("takes a duration of its own", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => void result.current.notify({ message: "Bref", durationMs: 1000 }));
    act(() => void vi.advanceTimersByTime(1000));

    expect(screen.queryByText("Bref")).not.toBeInTheDocument();
  });

  it("goes away when dismissed, by the page or by the user", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    let id = 0;
    act(() => {
      id = result.current.notify({ message: "Une" });
    });
    act(() => result.current.dismiss(id));
    expect(screen.queryByText("Une")).not.toBeInTheDocument();

    act(() => void result.current.notify({ message: "Deux" }));
    fireEvent.click(screen.getByRole("button", { name: "Fermer la notification" }));
    expect(screen.queryByText("Deux")).not.toBeInTheDocument();
  });

  it("never shows more than a few at once: the oldest goes first", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      for (let i = 1; i <= MAX_TOASTS + 1; i++) result.current.notify({ message: `Message ${i}` });
    });

    expect(screen.queryByText("Message 1")).not.toBeInTheDocument();
    expect(screen.getByText(`Message ${MAX_TOASTS + 1}`)).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(MAX_TOASTS);
  });

  it("gives each notification its own identifier", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    const ids: number[] = [];
    act(() => {
      ids.push(result.current.notify({ message: "a" }), result.current.notify({ message: "b" }));
    });

    expect(new Set(ids).size).toBe(2);
  });

  it("refuses to be used outside the provider", () => {
    expect(() => render(createElement(Outside))).toThrow("ToastProvider");
  });
});
