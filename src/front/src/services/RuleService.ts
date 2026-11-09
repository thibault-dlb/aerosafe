import { Rule, type RuleChanges, type RuleJson } from "@/models/Rule";
import { ApiClient } from "@/services/ApiClient";

/** Calls the rule settings endpoints of the API (BF-13, UC-05). */
export class RuleService {
  constructor(private readonly client: ApiClient = new ApiClient()) {}

  async list(): Promise<Rule[]> {
    const json = await this.client.get<RuleJson[]>("/v1/rules");
    return json.map((item) => Rule.fromJson(item));
  }

  async update(code: string, changes: RuleChanges): Promise<Rule> {
    const json = await this.client.patch<RuleJson>(`/v1/rules/${encodeURIComponent(code)}`, changes);
    return Rule.fromJson(json);
  }
}
