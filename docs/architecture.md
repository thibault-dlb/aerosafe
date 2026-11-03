# Architecture

Source: specifications §VI.1.10 and §VII.1, and [technology choices](technology-choices.md).

The detailed architecture is `TBD`: it is produced during the design phase, including a component diagram showing the flows between components.

## Components

| Component | Role | Technology |
| --- | --- | --- |
| Authentication | Accounts and roles (User / Supervisor) | `TBD` |
| Web interface | Lookup, analysis and supervision | React, TypeScript; mapping library `TBD` |
| API | Exposes business services and data | Python, FastAPI |
| Database | Stores aircraft, observations and alerts | PostgreSQL |
| Business rules engine | Evaluates rules R1 to R5 and generates alerts | Python |
| AI module (optional) | Anomaly detection and anomaly score | Python machine learning library, `TBD` |

## Stated flows

- OpenSky Network data is retrieved, normalised and stored in PostgreSQL.
- The rules engine periodically evaluates the rules on the collected data.
- Generated alerts are stored in the database and shown on the dashboard.

## Design constraints

### Code

- Use object-oriented programming whenever possible. See [contributing](../CONTRIBUTING.md).
- Adding a business rule or the AI module must not require reworking what exists (NF-06).
- API endpoints check the caller's role before running a restricted operation (§VI.1.1).

### Data source

- OpenSky Network coverage depends on its collaborative receiver network and is not geographically uniform.
- API access conditions (quotas, query frequency, authentication) must be checked and respected. The application must degrade cleanly when the source is unavailable or rate-limited.
- Data can contain missing or inconsistent fields, so it must be cleaned and validated before use.
- The application must stay accessible and stable during demonstrations, including when the source is temporarily unavailable (NF-04).

### Production

- All code lives in a single Git repository with an explicit branching strategy.
- The whole application can be launched through containers, with no manual dependency installation.
- The CI pipeline runs the automated tests on every code change.

## Planned UML diagrams

| Diagram | Content | Status |
| --- | --- | --- |
| Use cases | Actors: User, Supervisor | `TBD` |
| Classes | Aircraft, Observation, Flight, Rule, Alert, User | `TBD` |
| Sequence | "Detection and generation of an alert" scenario | `TBD` |
| Components | Application architecture | `TBD` |

## Repository layout

`TBD`.
