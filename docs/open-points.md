# Open points

Items the reference documents do not settle. Nothing here has been decided on the team's behalf. Last updated: 2026-11-02.

## Contradictions in the specifications

The specifications are reproduced as written in this repository. These points need to be settled with the supervising teacher, since any change to the specifications requires an amendment.

| ID | Topic | What the specifications say | Question |
| --- | --- | --- | --- |
| C-01 | Priority of BF-08 | CA-01 refers to "priority E functional requirements (BF-01 to BF-12)", but §III.1 gives BF-08 (flight statistics) priority I | Is BF-08 required for acceptance? |
| C-02 | Account creation | BF-01 includes account creation; UC-06 has the Supervisor create accounts; BF-14 (account administration by the Supervisor) is priority I | Can users sign up themselves, or does a Supervisor create every account? |
| C-03 | Processing alerts | UC-04 lets the Supervisor mark an alert as processed and updates its state, but BF-12 and the Alert entity (§VI.1.9) have no such state | Does an alert store a processing state? |
| C-04 | Acceptance scope | Priority E is defined as "required for acceptance", yet acceptance testing (§IX.2) covers UC-01 to UC-06, which include UC-05 (BF-13, priority I, "eventually") and UC-06 (BF-14, priority I) | Are UC-05 and UC-06 required for acceptance? |
| C-05 | Account deletion | §VII.3 requires the ability to delete an account under the GDPR; UC-06 only lists create, modify and deactivate, and no requirement covers deletion | How and by whom is an account deleted? |
| C-06 | Supervisor access to trajectories | UC-01 explicitly extends to the Supervisor; UC-02 names only the User as actor | Can the Supervisor view trajectories? |

## Gaps in the milestones

| ID | Topic | Detail |
| --- | --- | --- |
| G-01 | Requirements with no milestone | The wording of J2 and J3 does not name BF-07 (trajectory), BF-08 (statistics), BF-13 (rule settings) or BF-14 (account management) |

## Pending decisions

| ID | Topic | Status |
| --- | --- | --- |
| D-01 | Mapping library | Not decided; must be open source, chosen with the selection grid |
| D-02 | CI/CD tool | Not decided; chosen with the selection grid |
| D-04 | Thresholds, units and calculations of rules R1 to R5 | Set in a second stage of the project |
| D-05 | Rule evaluation frequency | Not specified ("periodically") |
| D-06 | Time continuity criterion for grouping observations into flights | Not specified |
| D-07 | Milestone dates | Unknown; J1 is to be set with the supervising teacher |
| D-08 | Status of J1 | To be confirmed |
| D-09 | Allocation of work among group members | Not defined; the specifications require the workload to be shared (§VII.2) and the presentation to cover group organisation |
| D-10 | Repository layout and module organisation | Not decided |
| D-12 | Frontend test and lint tools | Not decided |
| D-13 | Commit scopes and version numbering scheme | Not decided |
| D-14 | Machine learning library (bonus) | Not decided |

## Checks to do

| ID | Topic | Detail |
| --- | --- | --- |
| V-01 | OpenSky Network conditions | Check the terms of use, quotas, query frequency and authentication (§V.1, §VII.1, §VII.3) |
| V-02 | Public sharing | Sharing has not been validated by the supervising teacher (§V.2); the repository has been private since 2026-11-02 |
| V-03 | Teacher access | The supervising teacher needs access to the private repository (§VIII.2); the repository owner must grant it |
