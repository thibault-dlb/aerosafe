# AeroSafe

Intelligent application for monitoring and analysing aeronautical data.

AeroSafe is the capstone project ("projet fil rouge") of the Software Engineering and DevOps course ("Génie Logiciel et Développement Opérationnel") at IPSA, academic year 2026-2027. It uses public data from the OpenSky Network to track aircraft, reconstruct their trajectories and detect unusual situations.

> **Disclaimer:** AeroSafe is an educational project. It is not a certified air traffic surveillance or management system and must not be used operationally.

## Status

Only the project foundations exist so far: an API with a health check, an empty web interface and the container stack. No business feature has been developed yet. Anything marked `TBD` has not been decided or produced yet.

See the [roadmap](ROADMAP.md) for the steps and next actions.

## Planned features

- Search for and view aircraft information
- Analyse observations and flight parameters (position, altitude, speed, heading)
- Reconstruct trajectories and display them on a map
- Detect unusual behaviour with a business rules engine (rules R1 to R5)
- Generate and store alerts
- Provide a supervision dashboard
- Analyse the aeronautical and geospatial data collected
- Optional bonus: anomaly detection with machine learning, compared with the rules engine

## User profiles

| Profile | Purpose |
| --- | --- |
| User | Look up and analyse aeronautical data |
| Supervisor | Supervise aircraft, business rules and alerts through the dashboard |

## Tech stack

| Component | Technology | Status |
| --- | --- | --- |
| Data source | OpenSky Network | Set by the project sheet |
| Database | PostgreSQL 17 | Decided (the sheet says "such as PostgreSQL") |
| Backend / API | Python 3.11+, FastAPI | Set by the project sheet |
| ORM and migrations | SQLAlchemy 2.0 (async), Alembic | Decided |
| Frontend | React 19, TypeScript, Vite | Decided |
| Mapping | Leaflet (BSD-2-Clause) | Decided, wrapper to confirm |
| Versioning | Git, hosted on GitHub | In place |
| CI/CD | GitHub Actions | Decided, workflow to write |
| Containers | Docker | Set by the project sheet |
| Python tests and linting | pytest (asyncio, cov, xdist), ruff; minimum 80% coverage | Decided |
| Frontend tests | Vitest, Testing Library, Playwright; minimum 80% coverage | Decided |
| Cache | Redis | Deferred, only if needed |
| AI module (bonus) | Python machine learning library, `TBD` | Open |

The reasoning behind each choice is in [technology choices](docs/technology-choices.md).

## Getting started

`TBD`: there is nothing to install or run yet.

The application must eventually start from a single documented command, using containers, on a machine with no prior setup. See [installation and configuration](docs/installation.md).

## Documentation

| Document | Content |
| --- | --- |
| [Roadmap](ROADMAP.md) | Steps, deliverables, next actions |
| [Contributing](CONTRIBUTING.md) | Coding, commit, testing and documentation rules |
| [Requirements](docs/requirements.md) | Scope, requirements, user profiles, use cases |
| [Business rules](docs/business-rules.md) | Rules R1 to R5 and alert format |
| [Data model](docs/data-model.md) | Planned entities |
| [Database conventions](docs/database-conventions.md) | Naming, keys, types, indexes, timestamps, migrations, security, checklist |
| [Architecture](docs/architecture.md) | Components, constraints, planned UML diagrams |
| [Technology choices](docs/technology-choices.md) | Selection grid and decisions |
| [Installation and configuration](docs/installation.md) | How to install, configure and run the application |
| [API](docs/api.md) | Backend API reference |
| [User guide](docs/user-guide.md) | How to use the application, by profile |
| [Testing](docs/testing.md) | Test strategy and acceptance criteria |
| [Dependencies](docs/dependencies.md) | Dependencies and their licences |
| [Known issues](docs/known-issues.md) | Known issues register and warranty terms |
| [Change requests](docs/change-requests.md) | Change requests register |
| [Project terms](docs/project-terms.md) | Intellectual property, confidentiality, compliance, penalties |
| [Open points](docs/open-points.md) | Pending decisions, ambiguities in the project sheet, items not in the sheet |

The [project sheet](Fiche_projet_AeroSafe_IPSA.pdf) (Fiche de projet, in French) is the only source of truth and prevails over the English documentation in this repository.

The [specifications](Cahier_Des_Charge_Projet_Fil_Rouge.pdf) (Cahier des charges, version 1.0, 14 September 2026) are a secondary document. Anything they add to the project sheet (requirement codes, priorities, milestones, use cases, contractual terms) is not binding and is flagged as not in the project sheet in the documentation.

## Team

Thibault, Jules, Yassine, Sacha and Louis-Amaury.

Supervising teacher: Sirine SBOUI.

## Ownership and licence

No open-source licence has been chosen. The project sheet says nothing about intellectual property. The terms in [project terms](docs/project-terms.md) come from the specifications and are not confirmed.
