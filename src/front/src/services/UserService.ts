import { Account, type AccountChanges, type AccountJson, AccountPage, type AccountPageJson, CreatedAccount, type CreatedAccountJson } from "@/models/Account";
import { ApiClient } from "@/services/ApiClient";

/** What the list of accounts asks for. */
export interface AccountQuery {
  /** Part of the e-mail address. */
  search?: string;
  limit: number;
  offset: number;
}

/** Calls the account management endpoints of the API, reserved to Supervisors (UC-11 to UC-13). */
export class UserService {
  constructor(private readonly client: ApiClient = new ApiClient()) {}

  async list({ search, limit, offset }: AccountQuery): Promise<AccountPage> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set("search", search);
    return AccountPage.fromJson(await this.client.get<AccountPageJson>(`/v1/users?${params}`));
  }

  /** Creates an account with a generated password, which comes back this once. */
  async create(email: string, role: string): Promise<CreatedAccount> {
    return CreatedAccount.fromJson(await this.client.post<CreatedAccountJson>("/v1/users", { email, role }));
  }

  async update(id: string, changes: AccountChanges): Promise<Account> {
    return Account.fromJson(await this.client.patch<AccountJson>(`/v1/users/${encodeURIComponent(id)}`, changes));
  }

  async anonymise(id: string): Promise<Account> {
    return Account.fromJson(await this.client.post<AccountJson>(`/v1/users/${encodeURIComponent(id)}/anonymise`));
  }
}
