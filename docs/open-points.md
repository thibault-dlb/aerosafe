# Open points

Items the reference documents do not settle. The [project sheet](../Fiche_projet_AeroSafe_IPSA.pdf) is the only source of truth. Nothing here has been decided on the team's behalf. Last updated: 2026-11-03.

## Pending decisions

| ID | Topic | Status |
| --- | --- | --- |
| D-01 | Mapping library | Leaflet, decided on 2026-11-03 and scored against the grid in [technology choices](technology-choices.md#mapping-library-leaflet). Open: the `react-leaflet` wrapper is under the Hippocratic License 2.1, which is not an open-source licence, so Leaflet would be used directly |
| D-02 | CI/CD tool | GitHub Actions, decided on 2026-11-03 and scored against the grid in [technology choices](technology-choices.md#cicd-tool-github-actions). The workflow file is still to write |
| D-04 | Thresholds, units and calculations of rules R1 to R5 | The sheet defers them to "a second stage" (§6) |
| D-05 | Rule evaluation frequency | Not specified. The sheet does not say that rules are evaluated periodically |
| D-06 | How observations are grouped into flights | Not specified. The sheet speaks of reconstructing trajectories (§5) and names no Flight entity or continuity criterion |
| D-14 | Machine learning library (bonus) | Not decided |

## Ambiguities in the project sheet

| ID | Topic | What the sheet says | Question |
| --- | --- | --- | --- |
| A-01 | R1 and R2 overlap | R1: "too long a delay since the last contact"; R2: "a position that has become too old" (§6) | What separates the two: the last message received, or the timestamp of the last position? |
| A-02 | Scope of the Supervisor | Supervises aircraft, business rules and alerts through a Dashboard (§3) | Can the Supervisor change rule thresholds, mark alerts as processed, manage accounts? The sheet does not say |
| A-03 | Mandatory alert fields | An alert "may contain" the aircraft, rule, date and time, criticality (optional), observed value, threshold and message (§6) | Which fields are mandatory? None is declared so |
| A-04 | Dashboard and flight statistics | Both are named (§2, §5) and neither is described | What does the Dashboard show, and which statistics are computed? |
| A-05 | PostgreSQL | "A database such as PostgreSQL" (§4) | PostgreSQL is an example, not a requirement. The team chose PostgreSQL 17 |
| A-06 | Authentication | Step 3 lists "authentication and role management" among the development tasks | Delegating it to Keycloak turns that development into configuration; to justify at the defence |

## Repository decisions

Decisions that belong to the team and do not come from the sheet.

| ID | Topic | Status |
| --- | --- | --- |
| D-09 | Allocation of work among group members | Not defined. The sheet only requires the presentation to cover "group organisation" (deliverable 3) |
| D-13 | Commit scopes and version numbering scheme | Not decided |
| D-15 | Two naming styles in the database guide | The guide names tables and columns in uppercase French with prefixes (`DT_SUPPRESSION`, `BL_ACTIF`) but uses `created_at`, `updated_at`, `deleted_at`, `audit_logs` and `is_active` for timestamps, audit and reference tables. Which names apply is not stated. See [database conventions](database-conventions.md) |
| D-16 | French names versus the English rule | The guide requires French names and French `COMMENT ON` text; the project rule is English. `CLAUDE.md` records French database objects as the only exception |
| D-17 | Table for Keycloak users | The framework tables (`users`, ...) are legacy and never modified; the local user table is a business table and follows the business naming |
| D-18 | Storage of positions | The database guide requires PostGIS when a position is queried by location (the area search of UC-01 does), but the column naming for geometry is not defined in the guide. Left to the logical schema |

## Team decisions pending confirmation

Taken on 2026-11-03 to draw the [UML diagrams](uml/use-cases.md). Several go beyond the project sheet or settle points of the specifications. They are the team's choice, not the sheet's, and should be confirmed with the supervising teacher.

| Topic | Decision | Settles |
| --- | --- | --- |
| Supervisor scope | Dashboard, alerts, threshold changes, account management, and every User use case including trajectories | A-02, C-06 |
| Account creation | Self sign-up (role User); the Supervisor modifies roles, deactivates and deletes | C-02, C-05 |
| Processing an alert | `processedAt` and `processedBy` on the alert; no separate state | C-03 |
| Thresholds | Stored in the `Rule` entity, changed by the Supervisor | A-02 |
| R1 and R2 | R1 is the time since the last message received; R2 is the age of the last known position | A-01 |
| Flights | `Flight` is an explicit entity grouping observations | D-06 (entity only; the continuity criterion stays open) |
| Users | Local `User` row linked to Keycloak by `keycloakId` | A-06 |
| Processing | Collection and evaluation run as scheduled tasks in the API; no worker container | D-05 (frequency stays open) |
| AI module | Shown in the diagrams as optional, with an anomaly score | Bonus |

## Not in the project sheet

Everything below comes from the specifications (`Cahier_Des_Charge_Projet_Fil_Rouge.pdf`). It does not appear in the project sheet, so none of it is binding. It becomes relevant only if the supervising teacher confirms that the specifications apply.

### Contradictions in the specifications

| ID | Topic | What the specifications say | Question |
| --- | --- | --- | --- |
| C-01 | Priority of BF-08 | CA-01 refers to "priority E functional requirements (BF-01 to BF-12)", but §III.1 gives BF-08 (flight statistics) priority I | Is BF-08 required for acceptance? |
| C-02 | Account creation | BF-01 includes account creation; UC-06 has the Supervisor create accounts; BF-14 (account administration by the Supervisor) is priority I | Can users sign up themselves, or does a Supervisor create every account? |
| C-03 | Processing alerts | UC-04 lets the Supervisor mark an alert as processed and updates its state, but BF-12 and the Alert entity (§VI.1.9) have no such state | Does an alert store a processing state? |
| C-04 | Acceptance scope | Priority E is defined as "required for acceptance", yet acceptance testing (§IX.2) covers UC-01 to UC-06, which include UC-05 (BF-13, priority I, "eventually") and UC-06 (BF-14, priority I) | Are UC-05 and UC-06 required for acceptance? |
| C-05 | Account deletion | §VII.3 requires the ability to delete an account under the GDPR; UC-06 only lists create, modify and deactivate, and no requirement covers deletion | How and by whom is an account deleted? |
| C-06 | Supervisor access to trajectories | UC-01 explicitly extends to the Supervisor; UC-02 names only the User as actor | Can the Supervisor view trajectories? |

### Milestones

| ID | Topic | Detail |
| --- | --- | --- |
| G-01 | Requirements with no milestone | The wording of J2 and J3 does not name BF-07, BF-08, BF-13 or BF-14 |
| D-07 | Milestone dates | Unknown; every due date is "to be defined" |
| D-08 | Status of J1 | Cannot be checked: the project sheet defines no milestone |

### Checks to do

| ID | Topic | Detail |
| --- | --- | --- |
| V-01 | OpenSky Network conditions | Check the terms of use, quotas, query frequency and authentication (§V.1, §VII.1, §VII.3) |
| V-02 | Public sharing | Sharing has not been validated by the supervising teacher (§V.2); the repository has been private since 2026-11-02 |
| V-03 | Teacher access | The supervising teacher needs access to the private repository (§VIII.2); the repository owner must grant it |
