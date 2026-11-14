import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PreferencesProvider from "@/providers/PreferencesProvider";
import type { AlertService } from "@/services/AlertService";
import { PreferenceStore } from "@/services/PreferenceStore";

import { ALERT_COUNT_REFRESH_MS, useActiveAlertCount } from "./useActiveAlertCount";

function wrapper({ children }: { children: ReactNode }) {
  return <PreferencesProvider store={new PreferenceStore(null)}>{children}</PreferencesProvider>;
}

function serviceReturning(...totals: (number | Error)[]) {
  const search = vi.fn();
  totals.forEach((total) =>
    total instanceof Error ? search.mockRejectedValueOnce(total) : search.mockResolvedValueOnce({ total }),
  );
  search.mockResolvedValue({ total: totals.filter((value): value is number => typeof value === "number").at(-1) ?? 0 });
  return { search } as unknown as AlertService & { search: ReturnType<typeof vi.fn> };
}

describe("useActiveAlertCount", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the number of active alerts", async () => {
    const service = serviceReturning(3);

    const { result } = renderHook(() => useActiveAlertCount(true, service), { wrapper });

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(3));
    expect(service.search).toHaveBeenCalledWith({ status: "active", limit: 1 });
  });

  it("does not ask when it is not enabled", () => {
    const service = serviceReturning(3);

    const { result } = renderHook(() => useActiveAlertCount(false, service), { wrapper });

    expect(result.current).toBeNull();
    expect(service.search).not.toHaveBeenCalled();
  });

  it("reads again after the refresh delay, and keeps the last number when a reading fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const service = serviceReturning(2, new Error("offline"), 5);
    const { result } = renderHook(() => useActiveAlertCount(true, service), { wrapper });
    await waitFor(() => expect(result.current).toBe(2));

    await vi.advanceTimersByTimeAsync(ALERT_COUNT_REFRESH_MS);
    expect(service.search).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(2);

    await vi.advanceTimersByTimeAsync(ALERT_COUNT_REFRESH_MS);
    await waitFor(() => expect(result.current).toBe(5));
  });

  it("stops reading when it leaves", async () => {
    const service = serviceReturning(1);
    const { result, unmount } = renderHook(() => useActiveAlertCount(true, service), { wrapper });
    await waitFor(() => expect(result.current).toBe(1));
    vi.useFakeTimers();

    unmount();
    await vi.advanceTimersByTimeAsync(ALERT_COUNT_REFRESH_MS * 3);

    expect(service.search).toHaveBeenCalledTimes(1);
  });
});
