/** JSON of an account, as returned by the authentication endpoints. */
export interface UserJson {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

/** The two roles of the application: the codes of the `R_ROLE` reference table. */
export type RoleCode = "USER" | "SUPERVISOR";

/** An account of the application. `id` is the public identifier. */
export class User {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly role: string,
    readonly isActive: boolean,
  ) {}

  static fromJson(json: UserJson): User {
    return new User(json.id, json.email, json.role, json.is_active);
  }

  get isSupervisor(): boolean {
    return this.role === "SUPERVISOR";
  }

  /** Whether the role gives access to what `role` is needed for. A Supervisor can do everything. */
  can(role: RoleCode): boolean {
    return this.isSupervisor || this.role === role;
  }

  /** Two letters for the avatar: `jane.doe@x.fr` gives `JD`, `thibault@x.fr` gives `TH`. */
  get initials(): string {
    const local = this.email.split("@")[0] ?? "";
    const parts = local.split(/[._\-+]+/).filter(Boolean);
    const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : local.slice(0, 2);
    return letters.toUpperCase() || "?";
  }
}
