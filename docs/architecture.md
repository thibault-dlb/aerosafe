# Architecture

Source: project sheet §8 (authentication, web interface, FastAPI API, PostgreSQL database, rules engine, optional AI module) and step 2 (UML, architecture, database design, module organisation); specifications §VI.1.10 and §VII.1; and [technology choices](technology-choices.md).

The detailed architecture is `TBD`: it is produced during the design phase, including a component diagram showing the flows between components.

## Components

| Component | Role | Technology |
| --- | --- | --- |
| Authentication | Accounts and roles (User / Supervisor) | Keycloak, OpenID Connect |
| Gateway | Single entry point: serves the web interface and routes `/api` to the API | Nginx |
| Web interface | Lookup, analysis and supervision | React, TypeScript; mapping library `TBD` |
| API | Exposes business services and data | Python, FastAPI |
| Database | Stores aircraft, observations and alerts | PostgreSQL |
| Business rules engine | Evaluates rules R1 to R5 and generates alerts | Python |
| AI module (optional) | Anomaly detection and anomaly score | Python machine learning library, `TBD` |

## Repository layout

Decided on 2026-11-03 (D-10), following the Marine Nationale standard.

```text
.
├── docker-compose.yaml        Starts the whole application
├── .env.example               Template of the environment file (.env is never committed)
├── docs/                      Documentation
└── src/
    ├── api/                   Backend (Python, FastAPI)
    │   ├── main.py            Application factory and entry point
    │   ├── config/            Settings, one class per group, read from the environment
    │   ├── core/              Cross-cutting building blocks (database, logger, base model)
    │   ├── middlewares/       HTTP middlewares
    │   ├── models/            SQLAlchemy models
    │   ├── schemas/           Pydantic schemas of the API
    │   ├── routes/            Routers; `v1/` holds the versioned endpoints
    │   ├── services/          Business logic (rules engine, data collection)
    │   ├── database/          Alembic migrations
    │   ├── docker/            Container support files (database initialisation)
    │   └── tests/             pytest tests (`unit/`, `api/`)
    ├── front/                 Web interface (React, TypeScript, Vite)
    │   ├── src/
    │   │   ├── components/    Reusable components
    │   │   ├── config/        Runtime configuration
    │   │   ├── hooks/         React hooks
    │   │   ├── models/        Classes modelling the data
    │   │   ├── pages/         One folder or file per page
    │   │   ├── providers/     React context providers
    │   │   ├── services/      API client and other services
    │   │   └── test/          Test setup
    │   └── e2e/               Playwright end-to-end tests
    └── nginx/                 Gateway configuration
```

Unit tests of the frontend sit next to the code they test (`*.test.ts`, `*.test.tsx`).

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

The project sheet requires UML diagrams (step 2, deliverable 1) without listing them. The four below come from the specifications.

| Diagram | Content | Status |
| --- | --- | --- |
| [Use cases](uml/use-cases.md) | Actors: Visitor, User, Supervisor, Scheduler, OpenSky, Keycloak | Drafted, to validate |
| [Classes](uml/class-diagram.md) | Aircraft, Observation, Flight, Rule, Alert, User and reference classes | Drafted, to validate |
| [Sequence](uml/sequence-alert.md) | "Detection and generation of an alert" scenario | Drafted, to validate |
| [Components](uml/component-diagram.md) | Application architecture | Drafted, to validate |

The diagrams are written in Mermaid, which GitHub renders directly.
