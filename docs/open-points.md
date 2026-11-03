# Open points

Items the reference documents do not settle. The [project sheet](../Fiche_projet_AeroSafe_IPSA.pdf) is the only source of truth. Nothing here has been decided on the team's behalf. Last updated: 2026-11-03.

## Pending decisions

| ID | Topic | Status |
| --- | --- | --- |
| D-01 | Mapping library | Not decided. The sheet only requires trajectories to be shown on a map (§5) |
| D-02 | CI/CD tool | Not decided. The sheet asks for a CI/CD pipeline (step 7) without naming a tool |
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
