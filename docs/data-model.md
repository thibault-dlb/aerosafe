# Data model

Source: project sheet §4 to §6; specifications §VI.1.2, §VI.1.4, §VI.1.9 and §V.2 for the entity list.

The project sheet names no entity: the entities below are a design proposal. The Flight entity in particular is not in the sheet, which only speaks of reconstructing trajectories (D-06).

This is the provisional model from the specifications. The relational schema, integrity constraints and indexes are `TBD`: they are formalised during the design phase.

The schema must follow the [database conventions](database-conventions.md) (naming, keys, types, foreign keys, indexes, timestamps, comments). The entity names below are working names and are not yet converted to that convention.

## Entities

| Entity | Summary |
| --- | --- |
| Aircraft | Identifier (ICAO24), registration, model, airline |
| Observation / Position | Timestamp, latitude, longitude, altitude, speed, heading, associated aircraft |
| Flight | Group of observations forming a trajectory; origin and destination if available |
| Business rule | Identifier (R1 to R5), description, triggering thresholds |
| Alert | Aircraft concerned, rule triggered, date and time, observed value, threshold, criticality (optional), message |
| User | Identifier, role (User / Supervisor), authentication information |

## Stated relationships

- An observation is associated with an aircraft.
- A flight groups observations.
- An alert refers to an aircraft and a rule.

Cardinalities are `TBD`.

## Data rules

- **Source:** data comes mainly from the OpenSky Network. It is retrieved, normalised and then stored in PostgreSQL.
- **History:** stored history allows trajectory reconstruction and later analysis, regardless of whether the external source is available at that moment.
- **Cleaning:** source data can contain missing or inconsistent fields, so it must be cleaned and validated before use (§VII.1).
- **Flights:** successive observations of an aircraft are grouped into flights using a criterion of time continuity. The exact criterion is `TBD`.

## Personal data

Personal data is limited to user accounts: identifier, email address, password hash and role. It is used only to run the application and is not shared (§V.2). See [project terms](project-terms.md).

## Open points

Whether an alert stores a processing state is not settled. The project sheet mentions no processing state; see C-03 (specifications only) in [open points](open-points.md).
