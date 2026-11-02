# Business rules

Source: specifications §VI.1.5, §VI.1.6 and §VI.1.8.

## Rules

AeroSafe initially includes five business rules to detect unusual situations.

| Rule | Detects | Threshold | Unit | Criticality (optional) |
| --- | --- | --- | --- | --- |
| R1 | Too long a delay since the last contact | `TBD` | `TBD` | `TBD` |
| R2 | A position that has become too old | `TBD` | `TBD` | `TBD` |
| R3 | A large change in altitude | `TBD` | `TBD` | `TBD` |
| R4 | A large change in speed | `TBD` | `TBD` | `TBD` |
| R5 | A large change in heading | `TBD` | `TBD` | `TBD` |

The detailed definition and thresholds of each rule are set in a second stage of the project. The precise calculation behind each rule is also `TBD`.

## Evaluation

- The engine evaluates the rules periodically on the data collected (BF-09). The frequency is `TBD`.
- When a rule detects that a threshold has been exceeded, an alert is generated (UC-03).
- When no threshold is exceeded, no alert is generated and the evaluation is logged (UC-03).
- Rule triggers are logged so that the generation of an alert can be replayed and explained (NF-08).
- A threshold change made by the Supervisor applies at the next evaluation (UC-05).

## Extending the engine

Adding a rule must not require changing existing rules (§VI.1.5, NF-06).

## Alerts

When a rule is triggered, an alert is generated and stored in the database. An alert contains at least:

- the aircraft concerned;
- the rule triggered;
- the date and time of the trigger;
- the observed value;
- the reference threshold;
- an explanatory message.

The criticality level is an optional attribute.

The Supervisor can view, filter and sort alerts, and open their details (§VI.1.6).

## Testing

Each rule has at least one triggering test case and one non-triggering test case (§IX.2). See [testing](testing.md).

## AI comparison (bonus)

An optional module may detect anomalies and generate alerts through machine learning, to compare the deterministic approach (R1 to R5) with a learned one. The model uses historical data to identify atypical behaviour and produce an anomaly score. It only starts once all priority E requirements are met (§VII.2).
