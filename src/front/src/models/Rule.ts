import type { Criticality } from "@/models/Alert";

/** JSON of a business rule, as returned by `GET /v1/rules`. */
export interface RuleJson {
  code: string;
  description: string;
  threshold: number;
  unit: string;
  criticality: Criticality | null;
  is_active: boolean;
  updated_at: string;
}

/** Settings a Supervisor can change. Missing fields keep their value. */
export interface RuleChanges {
  threshold?: number;
  is_active?: boolean;
  criticality?: Criticality | null;
}

/** A business rule and its triggering threshold (BF-13, UC-05). */
export class Rule {
  constructor(
    readonly code: string,
    readonly description: string,
    readonly threshold: number,
    readonly unit: string,
    readonly criticality: Criticality | null,
    readonly isActive: boolean,
    readonly updatedAt: Date,
  ) {}

  static fromJson(json: RuleJson): Rule {
    return new Rule(
      json.code,
      json.description,
      json.threshold,
      json.unit,
      json.criticality,
      json.is_active,
      new Date(json.updated_at),
    );
  }
}
