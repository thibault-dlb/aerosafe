/** What the API asks of a new password: a length, and nothing else (OWASP: no composition rule). */
export class PasswordRules {
  static readonly MIN_LENGTH = 12;
  static readonly MAX_LENGTH = 128;

  static isLongEnough(password: string): boolean {
    return password.length >= PasswordRules.MIN_LENGTH;
  }

  /** How many of the required characters are there, from 0 to the minimum length. */
  static filled(password: string): number {
    return Math.min(password.length, PasswordRules.MIN_LENGTH);
  }
}
