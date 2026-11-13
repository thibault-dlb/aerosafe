import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDataMode } from "@/hooks/useDataMode";
import { useReplay } from "@/hooks/useReplay";
import { ReplayState, type ReplayStateJson } from "@/models/ReplayState";
import { ApiError } from "@/services/ApiClient";
import { DataModeService } from "@/services/DataModeService";
import { PreferenceStore } from "@/services/PreferenceStore";
import type { ReplayService } from "@/services/ReplayService";

import PreferencesProvider from "./PreferencesProvider";
import ReplayProvider, { POLL_MS, TICK_MS } from "./ReplayProvider";

function json(changes: Partial<ReplayStateJson> = {}): ReplayStateJson {
  return {
    available: true,
    start: "2022-08-01T00:00:00Z",
    end: "2022-08-31T23:59:59Z",
    simulated_at: "2022-08-14T15:00:00Z",
    speed: 60,
    paused: false,
    finished: false,
    server_time: "2026-11-13T10:00:00Z",
    allowed_speeds: [1, 10, 60],
    ...changes,
  };
}

function reading(changes: Partial<ReplayStateJson> = {}) {
  return () => Promise.resolve(ReplayState.fromJson(json(changes)));
}

function fakeService() {
  const service = {
    get: vi.fn(reading()),
    start: vi.fn(reading()),
    pause: vi.fn(reading({ paused: true })),
    resume: vi.fn(reading()),
    setSpeed: vi.fn(reading({ speed: 10 })),
  };
  return { service, api: service as unknown as ReplayService };
}

function storeIn(mode: "live" | "replay"): PreferenceStore {
  const values = new Map<string, string>();
  const store = new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
  new DataModeService(store).set(mode);
  return store;
}

function Probe() {
  const replay = useReplay();
  const { mode, setMode } = useDataMode();
  return (
    <>
      <p data-testid="mode">{mode}</p>
      <p data-testid="now">{replay?.now?.toISOString() ?? "none"}</p>
      <p data-testid="problem">{replay?.problem ?? "none"}</p>
      <p data-testid="loading">{String(replay?.loading)}</p>
      <p data-testid="speed">{replay?.state?.speed ?? "none"}</p>
      <button onClick={() => setMode("live")}>live</button>
      <button onClick={() => void replay?.start(new Date("2022-08-02T00:00:00Z"), 10)}>start</button>
      <button onClick={() => void replay?.pause()}>pause</button>
      <button onClick={() => void replay?.resume()}>resume</button>
      <button onClick={() => void replay?.setSpeed(10)}>speed</button>
    </>
  );
}

function renderIn(mode: "live" | "replay", api: ReplayService) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <PreferencesProvider store={storeIn(mode)}>
        <ReplayProvider service={api}>{children}</ReplayProvider>
      </PreferencesProvider>
    );
  }
  return render(<Probe />, { wrapper: Wrapper });
}

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

afterEach(() => {
  vi.useRealTimers();
  DataModeService.reset();
});

describe("ReplayProvider", () => {
  it("holds no clock and asks nothing in the live mode", async () => {
    vi.useFakeTimers();
    const { service, api } = fakeService();

    renderIn("live", api);
    await settle(POLL_MS * 2);

    expect(service.get).not.toHaveBeenCalled();
    expect(screen.getByTestId("now")).toHaveTextContent("none");
  });

  it("reads the clock in the replay mode", async () => {
    vi.useFakeTimers();
    const { service, api } = fakeService();

    renderIn("replay", api);
    expect(screen.getByTestId("loading")).toHaveTextContent("true");
    await settle();

    expect(service.get).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("now")).toHaveTextContent("2022-08-14T15:00:00.000Z");
  });

  it("moves the simulated instant every second, at the speed of the replay", async () => {
    vi.useFakeTimers();
    const { api } = fakeService();

    renderIn("replay", api);
    await settle();
    await settle(TICK_MS * 3);

    // 3 s at ×60.
    expect(screen.getByTestId("now")).toHaveTextContent("2022-08-14T15:03:00.000Z");
  });

  it("does not move a paused clock", async () => {
    vi.useFakeTimers();
    const { service, api } = fakeService();
    service.get.mockImplementation(reading({ paused: true }));

    renderIn("replay", api);
    await settle(TICK_MS * 5);

    expect(screen.getByTestId("now")).toHaveTextContent("2022-08-14T15:00:00.000Z");
  });

  it("reads the clock again now and then", async () => {
    vi.useFakeTimers();
    const { service, api } = fakeService();

    renderIn("replay", api);
    await settle();
    await settle(POLL_MS);

    expect(service.get).toHaveBeenCalledTimes(2);
  });

  it("reports an unreachable API and tries again", async () => {
    vi.useFakeTimers();
    const { service, api } = fakeService();
    service.get.mockRejectedValueOnce(new ApiError(500));

    renderIn("replay", api);
    await settle();
    expect(screen.getByTestId("problem")).toHaveTextContent("failed");
    expect(screen.getByTestId("now")).toHaveTextContent("none");

    await settle(POLL_MS);

    expect(screen.getByTestId("problem")).toHaveTextContent("none");
    expect(screen.getByTestId("now")).toHaveTextContent("2022-08-14T15:00:");
  });

  it("goes through the controls of the API and shows what it answers", async () => {
    vi.useFakeTimers();
    const { service, api } = fakeService();
    renderIn("replay", api);
    await settle();

    fireEvent.click(screen.getByText("pause"));
    await settle();
    expect(service.pause).toHaveBeenCalledTimes(1);
    await settle(TICK_MS * 5);
    expect(screen.getByTestId("now")).toHaveTextContent("2022-08-14T15:00:00.000Z");

    fireEvent.click(screen.getByText("resume"));
    fireEvent.click(screen.getByText("speed"));
    fireEvent.click(screen.getByText("start"));
    await settle();

    expect(service.resume).toHaveBeenCalledTimes(1);
    expect(service.setSpeed).toHaveBeenCalledWith(10);
    expect(service.start).toHaveBeenCalledWith(new Date("2022-08-02T00:00:00Z"), 10);
  });

  it("keeps the clock and says why when the API refuses a control", async () => {
    vi.useFakeTimers();
    const { service, api } = fakeService();
    service.pause.mockRejectedValueOnce(new ApiError(403));
    renderIn("replay", api);
    await settle();

    fireEvent.click(screen.getByText("pause"));
    await settle();

    expect(screen.getByTestId("problem")).toHaveTextContent("forbidden");
    expect(screen.getByTestId("now")).toHaveTextContent("2022-08-14T15:00:");
  });

  it("forgets the clock and stops asking when the live mode comes back", async () => {
    vi.useFakeTimers();
    const { service, api } = fakeService();
    renderIn("replay", api);
    await settle();

    fireEvent.click(screen.getByText("live"));
    await settle(POLL_MS * 3);

    expect(screen.getByTestId("mode")).toHaveTextContent("live");
    expect(screen.getByTestId("now")).toHaveTextContent("none");
    expect(service.get).toHaveBeenCalledTimes(1);
  });

  it("stops asking once removed", async () => {
    vi.useFakeTimers();
    const { service, api } = fakeService();

    const { unmount } = renderIn("replay", api);
    await settle();
    unmount();
    await settle(POLL_MS * 3);

    expect(service.get).toHaveBeenCalledTimes(1);
  });
});

describe("useReplay", () => {
  it("gives nothing outside the provider", () => {
    function Alone() {
      return <p>{useReplay() === null ? "no clock" : "clock"}</p>;
    }

    render(<Alone />);

    expect(screen.getByText("no clock")).toBeInTheDocument();
  });
});
