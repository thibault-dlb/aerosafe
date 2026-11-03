# Component diagram

Source: project sheet §8 (authentication, web interface, FastAPI API, PostgreSQL database, rules engine, optional AI module), [technology choices](../technology-choices.md) and the team decisions of 2026-11-03 listed in [open points](../open-points.md).

```mermaid
flowchart LR
  browser["Web browser<br/>React + TypeScript"]
  nginx["Gateway<br/>Nginx<br/>serves the interface, routes /api"]
  kc["Authentication<br/>Keycloak<br/>OpenID Connect"]
  opensky["OpenSky Network<br/>(external)"]

  subgraph api ["API container (FastAPI, Python)"]
    routes["Routes<br/>REST endpoints, role checks"]
    services["Services<br/>business logic"]
    scheduler["Scheduler<br/>scheduled tasks"]
    collector["Data collector"]
    engine["Rules engine<br/>R1 to R5"]
    ai["AI module<br/>(optional, bonus)"]
    orm["Persistence<br/>SQLAlchemy, Alembic"]
  end

  db[("PostgreSQL<br/>aircraft, observations,<br/>flights, rules, alerts, users")]
  kcdb[("Keycloak schema<br/>accounts, passwords")]

  browser -->|"HTTP"| nginx
  nginx -->|"/api"| routes
  browser -->|"login<br/>authorization code flow"| kc
  routes -->|"validate JWT<br/>(public keys)"| kc
  routes -->|"admin API<br/>create, modify, delete accounts"| kc
  routes --> services
  scheduler --> collector
  scheduler --> engine
  scheduler -.->|"bonus"| ai
  collector -->|"HTTPS"| opensky
  collector --> services
  engine --> services
  ai -.-> services
  services --> orm
  orm --> db
  kc --> kcdb
```

## Components

| Component | Role | Technology |
| --- | --- | --- |
| Web interface | Search, trajectories on a map, statistics, dashboard, alert and account management | React, TypeScript; mapping library `TBD` (D-01) |
| Gateway | Single entry point: serves the interface, routes `/api` to the API | Nginx |
| Authentication | Sign-up, login, passwords, roles `User` and `Supervisor` | Keycloak, OpenID Connect |
| Routes | REST endpoints; check the caller's role from the token before any restricted operation | FastAPI |
| Services | Business logic shared by the routes and the scheduled tasks | Python |
| Scheduler | Runs the collection and the evaluation periodically (D-05) | Inside the API process |
| Data collector | Retrieves, cleans and normalises OpenSky data | Python |
| Rules engine | Evaluates rules R1 to R5 from the thresholds stored in the database and generates alerts | Python |
| AI module | Anomaly detection and score, compared with the rules (bonus) | Python machine learning library, `TBD` (D-14) |
| Persistence | Access to the database and schema migrations | SQLAlchemy 2.0 (async), Alembic |
| Database | Stores aircraft, observations, flights, rules, alerts and users | PostgreSQL |

## Notes

- The API never handles passwords. Account creation by sign-up happens in Keycloak; the API creates the local `User` row on first login and calls the Keycloak admin API when the Supervisor modifies, deactivates or deletes an account.
- Collection and evaluation run in the API process, so there is a single backend container (team decision). A separate worker remains possible later without changing the services.
- Adding a rule or the AI module must not require reworking the existing components: the engine reads its rules from the database and the services are shared.
