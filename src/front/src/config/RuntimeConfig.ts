export interface RuntimeConfigValues {
  apiBaseUrl: string;
}

declare global {
  interface Window {
    RUNTIME_CONFIG?: RuntimeConfigValues;
  }
}

/** Reads the configuration injected at deployment time through /config.js. */
export class RuntimeConfig {
  static readonly DEFAULTS: RuntimeConfigValues = { apiBaseUrl: "http://localhost:8888/api" };

  static get(): RuntimeConfigValues {
    return { ...RuntimeConfig.DEFAULTS, ...window.RUNTIME_CONFIG };
  }
}
