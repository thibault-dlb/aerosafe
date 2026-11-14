import type { UnitSystem } from "@/services/UnitService";

/** A value with its unit, ready to be shown. */
export interface Measure {
  value: number;
  unit: string;
}

/** Conversions from the metric values of the API to the unit system chosen for the display. */
export class Units {
  static readonly FEET_PER_METRE = 3.280839895;
  static readonly KNOTS_PER_METRE_PER_SECOND = 1.943844492;
  static readonly NAUTICAL_MILES_PER_KILOMETRE = 0.539956803;
  static readonly FEET_PER_MINUTE_PER_METRE_PER_SECOND = 196.850394;

  /** An altitude, from metres. */
  static altitude(metres: number, system: UnitSystem): Measure {
    return system === "metric"
      ? { value: metres, unit: "m" }
      : { value: metres * Units.FEET_PER_METRE, unit: "ft" };
  }

  /** A ground speed, from metres per second. */
  static speed(metresPerSecond: number, system: UnitSystem): Measure {
    return system === "metric"
      ? { value: metresPerSecond, unit: "m/s" }
      : { value: metresPerSecond * Units.KNOTS_PER_METRE_PER_SECOND, unit: "kt" };
  }

  /** A distance, from kilometres. */
  static distance(kilometres: number, system: UnitSystem): Measure {
    return system === "metric"
      ? { value: kilometres, unit: "km" }
      : { value: kilometres * Units.NAUTICAL_MILES_PER_KILOMETRE, unit: "NM" };
  }

  /**
   * A value of a rule, in the unit of the rule. Only the vertical speed of R3 (`m/s`) changes,
   * to feet per minute: the other rules measure time, accelerations and turn rates, which have
   * no aeronautical form.
   */
  static ruleValue(value: number, unit: string, system: UnitSystem): Measure {
    if (system === "aeronautical" && unit === "m/s") {
      return { value: value * Units.FEET_PER_MINUTE_PER_METRE_PER_SECOND, unit: "ft/min" };
    }
    return { value, unit };
  }
}
