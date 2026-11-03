# Component diagram

Source: project sheet §8 (authentication, web interface, FastAPI API, PostgreSQL database, rules engine, optional AI module), [technology choices](../technology-choices.md) and the team decisions of 2026-11-03 listed in [open points](../open-points.md).

```mermaid
flowchart LR
  browser["Web browser<br/>React + TypeScript"]
  nginx["Gateway<br/>Nginx<br/>serves the interface, routes /api"]
  opensky["OpenSky Network<br/>(external)"]

  subgraph api ["API container (FastAPI, Python)"]
    routes["Routes<br/>REST endpoints, role checks"]
    auth["Authentication<br/>login, JWT, refresh token,<br/>argon2id"]
    services["Services<br/>business logic"]
    scheduler["Scheduler<br/>scheduled tasks"]
    collector["Data collector"]
    engine["Rules engine<br/>R1 to R5"]
    ai["AI module<br/>(optional, bonus)"]
    orm["Persistence<br/>SQLAlchemy, Alembic"]
  end

  db[("PostgreSQL<br/>aircraft, observations,<br/>flights, rules, alerts, users")]

  browser -->|"HTTP"| nginx
  nginx -->|"/api"| routes
  routes -->|"login, sign-up, refresh"| auth
  routes --> services
  auth --> services
  scheduler --> collector
  scheduler --> engine
  scheduler -.->|"bonus"| ai
  collector -->|"HTTPS"| opensky
  collector --> services
  engine --> services
  ai -.-> services
  services --> orm
  orm --> db
```

## Components

| Component | Role | Technology |
| --- | --- | --- |
| Web interface | Search, trajectories on a map, statistics, dashboard, alert and account management | React, TypeScript, Leaflet (react-leaflet) |
| Gateway | Single entry point: serves the interface, routes `/api` to the API | Nginx |
| Authentication | Sign-up, login, logout, refresh, password hashing, roles `User` and `Supervisor` | FastAPI, JWT (about 15 minutes), refresh token in an `HttpOnly` cookie, argon2id |
| Routes | REST endpoints; check the caller's role from the token before any restricted operation | FastAPI |
| Services | Business logic shared by the routes and the scheduled tasks | Python |
| Scheduler | Runs the collection, then the evaluation, at the period of the active collection profile (30 s or 120 s, D-05) | Inside the API process |
| Data collector | Retrieves, cleans and normalises OpenSky data | Python |
| Rules engine | Evaluates rules R1 to R5 from the thresholds stored in the database and generates alerts | Python |
| AI module | Anomaly detection and score, compared with the rules (bonus) | Python machine learning library, `TBD` (D-14) |
| Persistence | Access to the database and schema migrations | SQLAlchemy 2.0 (async), Alembic |
| Database | Stores aircraft, observations, flights, rules, alerts and users | PostgreSQL |

## Notes

- The API owns the accounts. Sign-up creates the `User` row with a hashed password; the Supervisor modifies roles and deactivates accounts through the same services; an account deletion request anonymises the row, it never deletes it.
- Collection and evaluation run in the API process, so there is a single backend container (team decision). A separate worker remains possible later without changing the services.
- Adding a rule or the AI module must not require reworking the existing components: the engine reads its rules from the database and the services are shared.
