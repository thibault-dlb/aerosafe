# Open points

Items the reference documents do not settle. The [project sheet](../Fiche_projet_AeroSafe_IPSA.pdf) is the only source of truth. Nothing here has been decided on the team's behalf. Last updated: 2026-11-07.

## Pending decisions

| ID | Topic | Status |
| --- | --- | --- |
| D-01 | Mapping library | Leaflet, decided on 2026-11-03 and scored against the grid in [technology choices](technology-choices.md#mapping-library-leaflet). The `react-leaflet` wrapper is under the Hippocratic License 2.1, which is not an open-source licence, so Leaflet is used directly through `MapService` |
| D-04 | Thresholds, units and calculations of rules R1 to R5 | The sheet defers them to "a second stage" (§6). Values proposed in [business rules](business-rules.md), to validate with the team and the supervising teacher |
| D-14 | Machine learning library (bonus) | Postponed: to be decided when the module starts |

Decided on 2026-11-03 and moved to [Team decisions](#team-decisions-pending-confirmation): D-02, D-05, D-06. D-01 is decided too but stays here until the licence of the wrapper is settled.

## Ambiguities in the project sheet

| ID | Topic | What the sheet says | Question |
| --- | --- | --- | --- |
| A-01 | R1 and R2 overlap | R1: "too long a delay since the last contact"; R2: "a position that has become too old" (§6) | Settled by the team: R1 is the time since the last message, R2 the age of the last position (to confirm with the teacher) |
| A-02 | Scope of the Supervisor | Supervises aircraft, business rules and alerts through a Dashboard (§3) | Settled by the team: thresholds, alert processing and account management (to confirm with the teacher) |
| A-03 | Mandatory alert fields | An alert "may contain" the aircraft, rule, date and time, criticality (optional), observed value, threshold and message (§6) | Settled by the team: aircraft, rule, date and time, message are mandatory |
| A-04 | Dashboard and flight statistics | Both are named (§2, §5) and neither is described | Settled by the team, see [business rules](business-rules.md#dashboard-a-04-team-decision) |
| A-05 | PostgreSQL | "A database such as PostgreSQL" (§4) | PostgreSQL is an example, not a requirement. The team chose PostgreSQL 17 |
| A-06 | Authentication | Step 3 lists "authentication and role management" among the development tasks | Closed: the team builds authentication in the API instead of using Keycloak |

## Repository decisions

Decisions that belong to the team and do not come from the sheet.

| ID | Topic | Status |
| --- | --- | --- |
| D-09 | Allocation of work among group members | Postponed. The sheet only requires the presentation to cover "group organisation" (deliverable 3) |
| D-13 | Commit scopes and version numbering scheme | Postponed |
| D-15 | Two naming styles in the database guide | Decided on 2026-11-03: technical columns and the audit table use the English names (`created_at`, `updated_at`, `deleted_at`, `is_active`, `audit_logs`); business columns keep the prefixed French names. See [database conventions](database-conventions.md) |
| D-16 | French names versus the English rule | The guide requires French names and French `COMMENT ON` text; the project rule is English. `CLAUDE.md` records French database objects as the only exception |
| D-17 | Table for users | Decided on 2026-11-03: `UTILISATEUR`, a business table. Not `W_`, which the guide reserves for temporary or import tables |
| D-18 | Storage of positions | Decided on 2026-11-03: PostGIS `geometry` column. Its exact name is set in the logical schema |

## Team decisions pending confirmation

Taken on 2026-11-03 to draw the [UML diagrams](uml/use-cases.md). Several go beyond the project sheet or settle points of the specifications. They are the team's choice, not the sheet's, and should be confirmed with the supervising teacher.

| Topic | Decision | Settles |
| --- | --- | --- |
| Supervisor scope | Dashboard, alerts, threshold changes, account management, and every User use case including trajectories | A-02, C-06 |
| Account creation | Self sign-up (role User); the Supervisor modifies roles, deactivates and deletes | C-02, C-05 |
| Processing an alert | `processedAt` and `processedBy` on the alert; no separate state | C-03 |
| Thresholds | Stored in the `Rule` entity, changed by the Supervisor | A-02 |
| R1 and R2 | R1 is the time since the last message received; R2 is the age of the last known position | A-01 |
| Flights | `Flight` is an explicit entity grouping observations. An observation joins the flight of the same `icao24` when at most N minutes separate it from the previous one; otherwise a new flight starts | D-06 |
| Authentication | Built in the API: FastAPI, JWT of about 15 minutes, revocable refresh token in an `HttpOnly` cookie, argon2id. Keycloak dropped | A-06 |
| Processing | Collection and evaluation run as scheduled tasks in the API; no worker container. Evaluation runs right after each collection | D-05 |
| Collection | Live only. Two profiles switched by configuration: Île-de-France every 30 s (1 credit per request) or metropolitan France every 120 s (3 credits). No historical data | D-05 |
| Mapping and CI | Leaflet (the `react-leaflet` wrapper depends on its licence, see D-01); GitHub Actions, scored in [technology choices](technology-choices.md) | D-01, D-02 |
| Alerts | Aircraft, rule, date and time, message mandatory; observed value, threshold and criticality optional | A-03 |
| Dashboard | Active alerts, tracked aircraft, alert statistics, collection state. Flight statistics: duration and distance, altitude and speed, number of observations | A-04 |
| Scope | Every requirement of the specifications is to be developed, including flight statistics (BF-08), alert configuration (UC-05) and account management (UC-06) | C-01, C-04 |
| Account deletion | A user can request it; the account is anonymised, never deleted, following the database guide | C-05 |
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
| V-01 | OpenSky Network conditions | Quotas and authentication checked on 2026-11-03 (see [architecture](architecture.md#data-source)); terms of use read on 2026-11-06 (see [OpenSky Network](opensky.md)). Still open: whether automated collection through the REST API counts as "operational use", which needs a written licence from OpenSky (§V.1, §VII.1, §VII.3) |
| V-02 | Public sharing | Settled on 2026-11-09: the supervising teacher agreed to make the repository public (§V.2) |
| V-03 | Teacher access | Settled on 2026-11-09: the repository is public, so the supervising teacher can read it (§VIII.2) |
