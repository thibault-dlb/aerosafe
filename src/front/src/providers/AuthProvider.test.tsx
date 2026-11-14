import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/hooks/useAuth";
import { ApiClient, ApiError } from "@/services/ApiClient";
import { AuthService } from "@/services/AuthService";

import AuthProvider from "./AuthProvider";

const USER = { id: "01HZ", email: "jane.doe@example.fr", role: "USER", is_active: true };
const TOKENS = { access_token: "access-1", token_type: "bearer", expires_in: 900, user: USER };

function serviceWith(post: ReturnType<typeof vi.fn>): AuthService {
  return new AuthService({ post } as unknown as ApiClient);
}

function Probe() {
  const { status, user, login, signUp, logout } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="email">{user?.email ?? "nobody"}</p>
      <button onClick={() => void login("jane.doe@example.fr", "a long enough password")}>log in</button>
      <button onClick={() => void signUp("jane.doe@example.fr", "a long enough password")}>sign up</button>
      <button onClick={() => void logout()}>log out</button>
    </div>
  );
}

function renderProbe(service: AuthService) {
  return render(
    <AuthProvider service={service}>
      <Probe />
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  afterEach(() => {
    ApiClient.setTokenProvider(() => null);
    ApiClient.setSessionRenewer(null);
  });

  it("is loading until the API has answered, then restores the session", async () => {
    renderProbe(serviceWith(vi.fn().mockResolvedValue(TOKENS)));

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("email")).toHaveTextContent("jane.doe@example.fr");
  });

  it("is anonymous when no session is kept", async () => {
    renderProbe(serviceWith(vi.fn().mockRejectedValue(new ApiError(401))));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(screen.getByTestId("email")).toHaveTextContent("nobody");
  });

  it("logs in, signs up and logs out through the service", async () => {
    const post = vi.fn().mockRejectedValueOnce(new ApiError(401)).mockResolvedValue(TOKENS);
    renderProbe(serviceWith(post));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));

    await act(async () => screen.getByText("log in").click());
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    await act(async () => screen.getByText("log out").click());
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    await act(async () => screen.getByText("sign up").click());

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(post).toHaveBeenCalledWith("/v1/auth/signup", expect.anything());
  });

  it("plugs the session into the API client", async () => {
    const service = serviceWith(vi.fn().mockResolvedValue(TOKENS));
    renderProbe(service);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await new ApiClient("http://api").get("/v1/aircraft");
    vi.unstubAllGlobals();

    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer access-1" });
  });

  it("makes its own service when none is given", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    vi.unstubAllGlobals();

    expect(screen.getByTestId("status")).toBeInTheDocument();
  });
});

describe("useAuth", () => {
  it("refuses to work outside the provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow("useAuth must be used under AuthProvider");

    quiet.mockRestore();
  });
});
