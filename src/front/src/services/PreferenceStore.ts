/** The part of `Storage` the store needs. */
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

/**
 * Remembers the user's choices (language, theme) in the browser.
 * The storage can be missing or throw (private window, blocked site data): the store then
 * keeps working without remembering anything.
 */
export class PreferenceStore {
  private readonly storage: StorageLike | null;

  constructor(storage?: StorageLike | null) {
    this.storage = storage === undefined ? PreferenceStore.browserStorage() : storage;
  }

  private static browserStorage(): StorageLike | null {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  get(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      this.storage?.setItem(key, value);
    } catch {
      // Not remembered: the choice only lasts until the page is closed.
    }
  }
}
