import { describe, expect, it, vi } from "vitest";

import type { AccountJson } from "@/models/Account";
import { ApiClient } from "@/services/ApiClient";

import { UserService } from "./UserService";

const ACCOUNT: AccountJson = {
  id: "01HZ",
  email: "jane.doe@example.fr",
  role: "USER",
  is_active: true,
  must_change_password: false,
  is_anonymised: false,
  created_at: "2026-11-09T10:00:00Z",
};

function serviceWith(client: Partial<Record<"get" | "post" | "patch", ReturnType<typeof vi.fn>>>) {
  return new UserService(client as unknown as ApiClient);
}

describe("UserService", () => {
  it("lists a page of accounts", async () => {
    const get = vi.fn().mockResolvedValue({ items: [ACCOUNT], total: 1 });

    const page = await serviceWith({ get }).list({ limit: 20, offset: 40 });

    expect(get).toHaveBeenCalledWith("/v1/users?limit=20&offset=40");
    expect(page.total).toBe(1);
    expect(page.items[0].email).toBe("jane.doe@example.fr");
  });

  it("searches by e-mail address", async () => {
    const get = vi.fn().mockResolvedValue({ items: [], total: 0 });

    await serviceWith({ get }).list({ search: "jane doe@", limit: 20, offset: 0 });

    expect(get).toHaveBeenCalledWith("/v1/users?limit=20&offset=0&search=jane+doe%40");
  });

  it("creates an account and returns its provisional password", async () => {
    const post = vi.fn().mockResolvedValue({ account: ACCOUNT, temporary_password: "ABCDE-FGHJK-MNPQR-STUVW" });

    const created = await serviceWith({ post }).create("jane.doe@example.fr", "SUPERVISOR");

    expect(post).toHaveBeenCalledWith("/v1/users", { email: "jane.doe@example.fr", role: "SUPERVISOR" });
    expect(created.temporaryPassword).toBe("ABCDE-FGHJK-MNPQR-STUVW");
  });

  it("changes the role or the state of an account", async () => {
    const patch = vi.fn().mockResolvedValue({ ...ACCOUNT, is_active: false });

    const account = await serviceWith({ patch }).update("01HZ", { is_active: false });

    expect(patch).toHaveBeenCalledWith("/v1/users/01HZ", { is_active: false });
    expect(account.isActive).toBe(false);
  });

  it("anonymises an account", async () => {
    const post = vi.fn().mockResolvedValue({ ...ACCOUNT, is_anonymised: true, is_active: false });

    const account = await serviceWith({ post }).anonymise("01HZ");

    expect(post).toHaveBeenCalledWith("/v1/users/01HZ/anonymise");
    expect(account.isAnonymised).toBe(true);
  });
});
