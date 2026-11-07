/** An alert as the API returns it. `id` is the public ULID. */
export class Alert {
  readonly id: string;
  readonly ruleCode: string;
  readonly triggeredAt: string;
  readonly message: string;

  constructor(id: string, ruleCode: string, triggeredAt: string, message: string) {
    this.id = id;
    this.ruleCode = ruleCode;
    this.triggeredAt = triggeredAt;
    this.message = message;
  }
}
