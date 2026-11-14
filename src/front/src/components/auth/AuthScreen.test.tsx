import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, type InitialEntry, RouterProvider, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import AuthProvider from "@/providers/AuthProvider";
import PreferencesProvider from "@/providers/PreferencesProvider";
import { ApiClient, ApiError } from "@/services/ApiClient";
import { AuthService } from "@/services/AuthService";
import { PreferenceStore } from "@/services/PreferenceStore";

import AuthScreen from "./AuthScreen";
import TwoFaced from "./TwoFaced";

const USER = { id: "01HZ", email: "jane@example.fr", role: "USER", is_active: true };
const TOKENS = { access_token: "access-1", token_type: "bearer", expires_in: 900, user: USER };
const PASSWORD = "a long enough password";

function Landing({ name }: { name: string }) {
  const { state } = useLocation();
  return (
    <p>
      {name} {JSON.stringify(state)}
    </p>
  );
}

type Post = ReturnType<typeof vi.fn>;

/** An API that has no session until the log in: the refresh at the start is refused. */
function api(handlers: Record<string, () => unknown> = {}): Post {
  return vi.fn(async (path: string) => {
    if (handlers[path]) return handlers[path]();
    if (path === "/v1/auth/refresh") throw new ApiError(401);
    if (path === "/v1/auth/signup") return USER;
    return TOKENS;
  });
}

function renderScreen(post: Post, entry: InitialEntry = "/login") {
  const router = createMemoryRouter(
    [
      {
        element: <AuthScreen />,
        children: [{ path: "/login" }, { path: "/signup" }],
      },
      { path: "/", element: <h1>Home</h1> },
      { path: "/dashboard", element: <Landing name="dashboard" /> },
      { path: "/alerts", element: <Landing name="alerts" /> },
    ],
    { initialEntries: [entry] },
  );
  render(
    <PreferencesProvider store={new PreferenceStore(null)}>
      <AuthProvider service={new AuthService({ post } as unknown as ApiClient)}>
        <RouterProvider router={router} />
      </AuthProvider>
    </PreferencesProvider>,
  );
  return router;
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: password } });
}

const submitButton = (name: string) => screen.getByRole("button", { name });

describe("AuthScreen", () => {
  afterEach(() => {
    ApiClient.setTokenProvider(() => null);
    ApiClient.setSessionRenewer(null);
  });

  it("opens on the log in mode", async () => {
    renderScreen(api());

    expect(await screen.findByRole("heading", { level: 1, name: "Bon retour" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connexion" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Inscription" })).not.toHaveAttribute("aria-current");
    expect(submitButton("Se connecter")).toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("opens on the sign up mode at /signup, with the length gauge", async () => {
    renderScreen(api(), "/signup");

    expect(await screen.findByRole("heading", { level: 1, name: "Créer un compte" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inscription" })).toHaveAttribute("aria-current", "page");
    expect(submitButton("Créer mon compte")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Longueur du mot de passe" })).toBeInTheDocument();
  });

  it("turns from one mode into the other, and keeps what was typed", async () => {
    const router = renderScreen(api());
    await screen.findByRole("heading", { level: 1, name: "Bon retour" });
    fill("jane@example.fr", "secret");

    fireEvent.click(screen.getByRole("link", { name: "Inscription" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Créer un compte" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/signup");
    expect(screen.getByLabelText("Adresse e-mail")).toHaveValue("jane@example.fr");
    expect(screen.getByLabelText("Mot de passe")).toHaveValue("secret");

    fireEvent.click(screen.getByRole("link", { name: "Se connecter" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Bon retour" })).toBeInTheDocument();
  });

  it("keeps the same radar in the page when the mode changes", async () => {
    renderScreen(api());
    const radar = await screen.findByRole("img", { name: /Écran radar/ });

    fireEvent.click(screen.getByRole("link", { name: "Inscription" }));
    await screen.findByRole("heading", { level: 1, name: "Créer un compte" });

    expect(screen.getByRole("img", { name: /Écran radar/ })).toBe(radar);
  });

  it("shows the educational notice, the tagline and the way back to the home page", async () => {
    renderScreen(api());
    await screen.findByRole("heading", { level: 1, name: "Bon retour" });

    expect(screen.getByRole("status")).toHaveTextContent("Projet pédagogique");
    expect(screen.getByRole("heading", { level: 2, name: "Surveillez le ciel" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour à l'accueil" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("group", { name: "Langue" })).toBeInTheDocument();
  });

  it("logs in and goes to the dashboard", async () => {
    const post = api();
    renderScreen(post);
    await screen.findByRole("heading", { level: 1, name: "Bon retour" });

    fill("  jane@example.fr ", PASSWORD);
    fireEvent.click(submitButton("Se connecter"));

    expect(await screen.findByText(/^dashboard/)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith("/v1/auth/login", { email: "jane@example.fr", password: PASSWORD });
  });

  it("goes back to the page that was asked for", async () => {
    renderScreen(api(), { pathname: "/login", state: { from: "/alerts" } });
    await screen.findByRole("heading", { level: 1, name: "Bon retour" });

    fill("jane@example.fr", PASSWORD);
    fireEvent.click(submitButton("Se connecter"));

    expect(await screen.findByText(/^alerts/)).toBeInTheDocument();
  });

  it("keeps the page that was asked for when switching mode", async () => {
    renderScreen(api(), { pathname: "/login", state: { from: "/alerts" } });
    await screen.findByRole("heading", { level: 1, name: "Bon retour" });
    fireEvent.click(screen.getByRole("link", { name: "Inscription" }));
    await screen.findByRole("heading", { level: 1, name: "Créer un compte" });

    fill("jane@example.fr", PASSWORD);
    fireEvent.click(submitButton("Créer mon compte"));

    expect(await screen.findByText(/^alerts/)).toBeInTheDocument();
  });

  it("leaves the screen at once when a session is already open", async () => {
    renderScreen(api({ "/v1/auth/refresh": () => TOKENS }));

    expect(await screen.findByText(/^dashboard/)).toBeInTheDocument();
  });

  it("says the e-mail or the password is wrong, and goes away with the mode", async () => {
    const post = api({
      "/v1/auth/login": () => {
        throw new ApiError(401);
      },
    });
    renderScreen(post);
    await screen.findByRole("heading", { level: 1, name: "Bon retour" });

    fill("jane@example.fr", PASSWORD);
    fireEvent.click(submitButton("Se connecter"));

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou mot de passe incorrect.");
    expect(submitButton("Se connecter")).toBeEnabled();

    fireEvent.click(screen.getByRole("link", { name: "Inscription" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it.each([
    [429, "Trop d'échecs de connexion"],
    [500, "Le serveur est injoignable"],
  ])("explains a failure %s", async (status, text) => {
    renderScreen(
      api({
        "/v1/auth/login": () => {
          throw new ApiError(status);
        },
      }),
    );
    await screen.findByRole("heading", { level: 1, name: "Bon retour" });

    fill("jane@example.fr", PASSWORD);
    fireEvent.click(submitButton("Se connecter"));

    expect(await screen.findByRole("alert")).toHaveTextContent(text);
  });

  it("does not call the API for an e-mail that cannot be right, or an empty password", async () => {
    const post = api();
    renderScreen(post);
    await screen.findByRole("heading", { level: 1, name: "Bon retour" });
    post.mockClear();

    fireEvent.click(submitButton("Se connecter"));

    expect(await screen.findByText("Saisissez une adresse e-mail valide.")).toBeInTheDocument();
    expect(screen.getByText("Saisissez votre mot de passe.")).toBeInTheDocument();
    expect(screen.getByLabelText("Adresse e-mail")).toBeInvalid();
    expect(post).not.toHaveBeenCalled();
  });

  it("asks for 12 characters when signing up, before calling the API", async () => {
    const post = api();
    renderScreen(post, "/signup");
    await screen.findByRole("heading", { level: 1, name: "Créer un compte" });
    post.mockClear();

    fill("jane@example.fr", "too short");
    fireEvent.click(submitButton("Créer mon compte"));

    await waitFor(() => expect(screen.getByLabelText("Mot de passe")).toBeInvalid());
    expect(screen.getByLabelText("Mot de passe")).toHaveAccessibleDescription(/12 caractères au minimum/);
    expect(post).not.toHaveBeenCalled();
  });

  it("signs up, logs in at once and welcomes the new user", async () => {
    const post = api();
    renderScreen(post, "/signup");
    await screen.findByRole("heading", { level: 1, name: "Créer un compte" });

    fill("jane@example.fr", PASSWORD);
    fireEvent.click(submitButton("Créer mon compte"));

    expect(await screen.findByText(/^dashboard/)).toHaveTextContent('{"welcome":true}');
    expect(post).toHaveBeenCalledWith("/v1/auth/signup", { email: "jane@example.fr", password: PASSWORD });
    expect(post).toHaveBeenCalledWith("/v1/auth/login", { email: "jane@example.fr", password: PASSWORD });
  });

  it("does not welcome anyone after a plain log in", async () => {
    renderScreen(api());
    await screen.findByRole("heading", { level: 1, name: "Bon retour" });

    fill("jane@example.fr", PASSWORD);
    fireEvent.click(submitButton("Se connecter"));

    expect(await screen.findByText(/^dashboard/)).not.toHaveTextContent("welcome");
  });

  it("says when the e-mail already has an account, and does not welcome a failed sign up", async () => {
    renderScreen(
      api({
        "/v1/auth/signup": () => {
          throw new ApiError(409);
        },
      }),
      "/signup",
    );
    await screen.findByRole("heading", { level: 1, name: "Créer un compte" });

    fill("jane@example.fr", PASSWORD);
    fireEvent.click(submitButton("Créer mon compte"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Cet e-mail a déjà un compte.");
  });

  it("disables the button while the request is on its way", async () => {
    let finish: (value: unknown) => void = () => undefined;
    renderScreen(api({ "/v1/auth/login": () => new Promise((resolve) => (finish = resolve)) }));
    await screen.findByRole("heading", { level: 1, name: "Bon retour" });
    fill("jane@example.fr", PASSWORD);

    fireEvent.click(submitButton("Se connecter"));

    await waitFor(() => expect(submitButton("Se connecter")).toBeDisabled());
    finish(TOKENS);
    expect(await screen.findByText(/^dashboard/)).toBeInTheDocument();
  });
});

describe("TwoFaced", () => {
  it("shows the text of the mode and hides the other from screen readers", () => {
    render(<TwoFaced mode="signup" login={<b>in</b>} signup={<b>up</b>} />);

    expect(screen.getByText("up")).toBeVisible();
    expect(screen.getByText("in").closest("[inert]")).not.toBeNull();
    expect(screen.getByText("in").closest("[aria-hidden='true']")).not.toBeNull();
  });
});
