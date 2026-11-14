import { describe, expect, it } from "vitest";

import { Account, AccountPage, CreatedAccount } from "./Account";

const json = {
  id: "01HZ",
  email: "jane.doe@example.fr",
  role: "SUPERVISOR",
  is_active: true,
  must_change_password: true,
  is_anonymised: false,
  created_at: "2026-11-09T10:00:00Z",
};

describe("Account", () => {
  it("is read from the JSON of the API", () => {
    const account = Account.fromJson(json);

    expect(account).toMatchObject({
      id: "01HZ",
      email: "jane.doe@example.fr",
      role: "SUPERVISOR",
      isActive: true,
      mustChangePassword: true,
      isAnonymised: false,
    });
    expect(account.createdAt).toEqual(new Date("2026-11-09T10:00:00Z"));
  });

  it("knows its initials and whether it is a Supervisor", () => {
    expect(Account.fromJson(json).initials).toBe("JD");
    expect(Account.fromJson(json).isSupervisor).toBe(true);
    expect(Account.fromJson({ ...json, role: "USER" }).isSupervisor).toBe(false);
  });

  it("reads a page of accounts with its total", () => {
    const page = AccountPage.fromJson({ items: [json], total: 41 });

    expect(page.total).toBe(41);
    expect(page.items[0]).toBeInstanceOf(Account);
  });

  it("reads a new account with its provisional password", () => {
    const created = CreatedAccount.fromJson({ account: json, temporary_password: "ABCDE-FGHJK-MNPQR-STUVW" });

    expect(created.account.email).toBe("jane.doe@example.fr");
    expect(created.temporaryPassword).toBe("ABCDE-FGHJK-MNPQR-STUVW");
  });
});
