# Use case diagram

Source: project sheet §2, §3 and §9 step 1, with the team decisions of 2026-11-03 listed in [open points](../open-points.md). Mermaid has no native UML use case diagram, so this is drawn as a flowchart: stadium shapes are actors, rounded shapes are use cases, dashed arrows are `include`, `extend` and generalisation.

```mermaid
flowchart LR
  visitor(["Visitor<br/>(not logged in)"])
  user(["User"])
  supervisor(["Supervisor"])
  scheduler(["Scheduler<br/>(system)"])
  opensky(["OpenSky Network<br/>(external)"])
  keycloak(["Keycloak<br/>(external)"])

  subgraph aerosafe ["AeroSafe"]
    uc09(["UC-09 Sign up"])
    uc10(["UC-10 Log in"])
    uc01(["UC-01 Search and view an aircraft"])
    uc02(["UC-02 View a flight trajectory and statistics"])
    uc04(["UC-04 Supervise and process alerts"])
    uc05(["UC-05 Configure a business rule"])
    uc06(["UC-06 Manage accounts and roles"])
    uc08(["UC-08 Collect OpenSky data"])
    uc03(["UC-03 Detect an unusual situation and generate an alert"])
    uc07(["UC-07 Compare rules and AI detection<br/>(bonus)"])
  end

  visitor --- uc09
  user --- uc01
  user --- uc02
  supervisor -.->|"inherits"| user
  supervisor --- uc04
  supervisor --- uc05
  supervisor --- uc06
  supervisor --- uc07
  scheduler --- uc08
  scheduler --- uc03
  opensky --- uc08
  keycloak --- uc10
  keycloak --- uc09

  uc01 -.->|"«include»"| uc10
  uc02 -.->|"«include»"| uc10
  uc04 -.->|"«include»"| uc10
  uc05 -.->|"«include»"| uc10
  uc06 -.->|"«include»"| uc10
  uc03 -.->|"«include»"| uc08
  uc05 -.->|"«extend»<br/>alert judged irrelevant"| uc04
  uc02 -.->|"«extend»<br/>from an aircraft record"| uc01
```

## Actors

| Actor | Role |
| --- | --- |
| Visitor | A person without an account. Can only sign up |
| User | Looks up and analyses aeronautical data (project sheet §3) |
| Supervisor | Supervises aircraft, business rules and alerts through the dashboard (project sheet §3). Inherits every use case of the User |
| Scheduler | Internal actor: the scheduled tasks of the API that collect data and evaluate the rules |
| OpenSky Network | External data source |
| Keycloak | External identity provider: accounts, passwords, roles |

## Use cases

| ID | Use case | Actor | Origin |
| --- | --- | --- | --- |
| UC-01 | Search for an aircraft (ICAO24, registration, airline, area) and view its record and observation history | User | Project sheet §2 |
| UC-02 | Reconstruct and view a flight trajectory on a map, with altitude and speed, and flight statistics | User | Project sheet §2, §5 |
| UC-03 | Evaluate rules R1 to R5 on the collected data and generate and store an alert when a threshold is exceeded | Scheduler | Project sheet §6 |
| UC-04 | Open the dashboard, filter and sort alerts, view an alert, mark it as processed | Supervisor | Project sheet §2, §3; processing from the specifications |
| UC-05 | View and adjust the threshold of a rule; applies at the next evaluation | Supervisor | Specifications (A-02) |
| UC-06 | Modify, deactivate or delete an account; assign a role | Supervisor | Specifications (C-05) |
| UC-07 | Compare the alerts of rules R1 to R5 with the anomaly scores of the AI model | Supervisor | Project sheet §7 (bonus) |
| UC-08 | Retrieve OpenSky data, clean and normalise it, store it in PostgreSQL | Scheduler | Project sheet §4 |
| UC-09 | Create one's own account (role User by default) | Visitor | Team decision (C-02) |
| UC-10 | Log in and out through Keycloak | All logged-in actors | Project sheet §8 (authentication component) |

UC-01 to UC-07 keep the numbering of the specifications. UC-06 no longer covers account creation by the Supervisor, since accounts are created by self sign-up (UC-09). UC-08, UC-09 and UC-10 are added here.

## Assumptions to confirm

- The Supervisor inherits every User use case, including trajectories (C-06, team decision).
- The Supervisor can modify roles, deactivate and delete accounts (C-05, team decision); creation is by self sign-up only.
- Rules are evaluated by the Scheduler, which is part of the API process (D-05: the frequency is still `TBD`).
