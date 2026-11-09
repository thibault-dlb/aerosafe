# Business rules

Source: project sheet §6; specifications §VI.1.5, §VI.1.6 and §VI.1.8 for the additional detail flagged below. OpenSky fields, units and terms: [OpenSky Network](opensky.md).

## Rules

AeroSafe initially includes five business rules to detect unusual situations.

| Rule | Detects | Threshold | Unit | Criticality (optional) |
| --- | --- | --- | --- | --- |
| R1 | Too long a delay since the last contact | 300 | seconds | Medium |
| R2 | A position that has become too old | 600 | seconds | Low |
| R3 | A large change in altitude | 30 | m/s (vertical rate) | High |
| R4 | A large change in speed | 2 | m/s² (acceleration) | Medium |
| R5 | A large change in heading | 5 | °/s (turn rate) | Medium |

**These values are a proposal (D-04), not a decision.** The project sheet defers thresholds and calculations to a second stage (§6). They are stored in the `Rule` entity and the Supervisor can change them (UC-05), so a wrong first guess costs nothing. They must be validated by the team and the supervising teacher, then tuned on real data.

### Proposed calculations

Notation: `now` is the time of the collection that has just run, not the time the engine runs, so a delay in the evaluation never makes the data look older than it is; for an aircraft, `p1` and `p2` are its two latest consecutive observations of the same flight, `Δt = p2.positionAt − p1.positionAt`. OpenSky gives altitude in metres, speed in m/s and heading in degrees (see [fields used by the rules](opensky.md#fields-used-by-the-rules)).

| Rule | Observed value | Triggers when |
| --- | --- | --- |
| R1 | `now − lastContactAt` of the latest observation | value > 300 s |
| R2 | `now − positionAt` of the latest observation | value > 600 s |
| R3 | `abs(p2.altitude − p1.altitude) / Δt` | value > 30 m/s, with `10 s ≤ Δt ≤ 300 s` |
| R4 | `abs(p2.speed − p1.speed) / Δt` | value > 2 m/s², with `10 s ≤ Δt ≤ 300 s` |
| R5 | `shortest_angle(p2.heading, p1.heading) / Δt`, where `shortest_angle` is in 0 to 180° | value > 5 °/s, with `10 s ≤ Δt ≤ 300 s` and speed above 50 m/s |

Reasoning behind the values:

- **Collection period.** The data is collected every 30 s or 120 s depending on the profile. R1 at 300 s means missing more than two cycles of the slowest profile. R2 is higher than R1 on purpose: a position is never more recent than the last contact (`positionAt ≤ lastContactAt`), so R2 with a threshold below R1 would always fire first or at the same time. With R2 above R1, R1 means "the aircraft went silent" and R2 means "it still sends messages but without a usable position" (A-01).
- **R3.** Airliners climb and descend at about 5 to 15 m/s. 30 m/s is roughly 5 900 ft/min, which is unusual for a commercial flight.
- **R4.** Normal acceleration of an airliner is about 1 m/s². 2 m/s² flags an abrupt change.
- **R5.** A standard-rate turn is 3 °/s. 5 °/s is well above it. The heading is compared as the shortest angle, so 359° to 1° is a 2° change. Measuring a rate and not an absolute change avoids false alerts with the 120 s period, where a normal turn can reach 90° between two points. Below 50 m/s the heading of OpenSky is too noisy to use.
- **R2 and missing positions.** OpenSky leaves the position time empty when no position was received in the last 15 seconds. R2 therefore uses the latest stored observation that has a position, never the latest raw state vector.
- **Rates, not raw differences.** R3 to R5 divide by `Δt`. Comparing raw differences would make the same manoeuvre trigger or not depending on how far apart the two observations are.
- **Window `10 s ≤ Δt ≤ 300 s`.** Too short a gap amplifies noise, too long a gap hides the real dynamics and would compare two different phases of a flight.

### Scope and deduplication

- Rules apply to aircraft that are **airborne** (`on_ground` false). R1 and R2 also stop being evaluated for an aircraft silent for more than 30 minutes, so that an aircraft which left the coverage zone does not raise alerts forever.
- An aircraft does not raise the same rule twice while the situation lasts: a new alert for the same aircraft and rule is generated only after the previous episode ended. An episode ends when the value goes back under the threshold, when the aircraft lands or is silent for more than 30 minutes, or when the rule is disabled. It stays open while an airborne aircraft lacks the data the rule needs (no position, no previous observation in the same flight).
- Observations that belong to no flight are not used for R3 to R5, since a rate needs two points of the same flight (D-06).
- An observation with a missing value (altitude, speed or heading) is skipped by the rule that needs it.

### Criticality

`R_CRITICITE` holds three values: low, medium, high. The mapping above is a proposal. The criticality is optional in the project sheet, so a rule without one is valid.

## Evaluation

- The engine evaluates the rules on the data collected (BF-09), right after each collection: every 30 s with the Île-de-France profile, every 120 s with the metropolitan France profile (D-05). The project sheet does not say that rules are evaluated periodically; this is the team's choice.
- When a rule detects that a threshold has been exceeded, an alert is generated (UC-03).
- When no threshold is exceeded, no alert is generated and the evaluation is logged (UC-03).
- Rule triggers are logged so that the generation of an alert can be replayed and explained (NF-08).
- A threshold change made by the Supervisor applies at the next evaluation (UC-05).

## Extending the engine

Adding a rule must not require changing existing rules (§VI.1.5, NF-06). Each rule is a separate class with the same `check` method (see the [alert sequence diagram](uml/sequence-alert.md)), and the engine reads the list of rules from the `Rule` entity, so it is not limited to R1 to R5.

## Alerts

When a rule is triggered, an alert is generated and stored in the database. The project sheet says an alert "may contain" the items below and declares none mandatory (A-03). Team decision of 2026-11-03:

- mandatory: the aircraft concerned, the rule triggered, the date and time of the trigger, an explanatory message;
- optional: the observed value, the reference threshold, the criticality level. The engine fills the observed value and the threshold on every alert it generates, so that it can be explained and replayed (NF-08).

The Supervisor can view, filter and sort alerts, and open their details (§VI.1.6). This comes from the specifications only: the project sheet does not describe alert management.

### Dashboard (A-04, team decision)

The minimal Dashboard of the Supervisor shows:

- active alerts and alerts not yet processed, filterable by rule and date, with the action "mark as processed";
- the aircraft currently tracked, on a map;
- alert statistics: number of alerts per rule and per period;
- the state of the collection: last successful run, OpenSky credits used, errors.

Flight statistics, computed per flight: duration and distance, altitude and speed (maximum, mean), and number of observations.

## Testing

Each rule has at least one triggering test case and one non-triggering test case (§IX.2, specifications only). See [testing](testing.md).

Proposed cases, for an airborne aircraft and two observations of the same flight:

| Rule | Triggering case | Non-triggering case |
| --- | --- | --- |
| R1 | Last contact 420 s before `now` | Last contact 60 s before `now` |
| R2 | Last position 900 s before `now`, last contact 20 s before | Last position 120 s before `now` |
| R3 | +1,200 m in 30 s (40 m/s) | +300 m in 30 s (10 m/s) |
| R4 | 230 → 170 m/s in 20 s (3 m/s²) | 230 → 220 m/s in 30 s (0.33 m/s²) |
| R5 | 90° → 200° in 20 s at 200 m/s (110°, 5.5 °/s) | 350° → 10° in 20 s at 200 m/s (20°, 1 °/s) |

Edge cases:

- R3 to R5: a pair with `Δt` = 5 s or `Δt` = 600 s is ignored.
- R3 to R5: an aircraft with `on_ground` true is ignored.
- R5: a 110° turn in 20 s at 30 m/s (below 50 m/s) is ignored.
- R2: a latest observation without a position falls back to the previous observation that has one.
- Deduplication: a second evaluation of the same episode raises no new alert; a new episode after the value went back under the threshold raises one.

## AI comparison (bonus)

An optional module may detect anomalies and generate alerts through machine learning, to compare the deterministic approach (R1 to R5) with a learned one. The model uses historical data to identify atypical behaviour and produce an anomaly score. It only starts once all priority E requirements are met (§VII.2, specifications only; the project sheet only calls the module optional or a bonus).
