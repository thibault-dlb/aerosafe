import { User } from "@/models/User";

/** JSON of an account in the list of the Supervisor, as returned by `GET /v1/users`. */
export interface AccountJson {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  is_anonymised: boolean;
  created_at: string;
}

/** One page of accounts and the number of accounts matching the search, all pages included. */
export interface AccountPageJson {
  items: AccountJson[];
  total: number;
}

/** The answer to the creation of an account: the account and its provisional password. */
export interface CreatedAccountJson {
  account: AccountJson;
  temporary_password: string;
}

/** What a Supervisor can change about an account. Missing fields stay as they are. */
export interface AccountChanges {
  role?: string;
  is_active?: boolean;
}

/** An account as the list of the Supervisor shows it. `id` is the public identifier. */
export class Account {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly role: string,
    readonly isActive: boolean,
    readonly mustChangePassword: boolean,
    readonly isAnonymised: boolean,
    readonly createdAt: Date,
  ) {}

  static fromJson(json: AccountJson): Account {
    return new Account(
      json.id,
      json.email,
      json.role,
      json.is_active,
      json.must_change_password,
      json.is_anonymised,
      new Date(json.created_at),
    );
  }

  /** Two letters for the avatar, like the account card of the side bar. */
  get initials(): string {
    return new User(this.id, this.email, this.role, this.isActive).initials;
  }

  get isSupervisor(): boolean {
    return this.role === "SUPERVISOR";
  }
}

/** One page of accounts. */
export class AccountPage {
  constructor(
    readonly items: Account[],
    readonly total: number,
  ) {}

  static fromJson(json: AccountPageJson): AccountPage {
    return new AccountPage(json.items.map((item) => Account.fromJson(item)), json.total);
  }
}

/** A new account with the provisional password the API shows only once. */
export class CreatedAccount {
  constructor(
    readonly account: Account,
    readonly temporaryPassword: string,
  ) {}

  static fromJson(json: CreatedAccountJson): CreatedAccount {
    return new CreatedAccount(Account.fromJson(json.account), json.temporary_password);
  }
}
