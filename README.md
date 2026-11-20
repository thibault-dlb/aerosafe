# AeroSafe

Intelligent application for monitoring and analysing aeronautical data.

AeroSafe is the capstone project ("projet fil rouge") of the Software Engineering and DevOps course ("Génie Logiciel et Développement Opérationnel") at IPSA, academic year 2026-2027. It uses public data from the OpenSky Network and from the adsb.fi open data API to track aircraft, reconstruct their trajectories and detect unusual situations.

> **Disclaimer:** AeroSafe is an educational project. It is not a certified air traffic surveillance or management system and must not be used operationally.

## Status

The application is built and runs from the container stack: the collection of OpenSky and adsb.fi data in parallel, the rules R1 to R5 and the alerts, the aircraft lookup and flight trajectories with their statistics, the accounts and roles, the supervision dashboard and the replay of historical traffic, with a French and English web interface. Not started: the deployment and monitoring, and the optional AI module. The live collections are off by default on each instance (`COLLECTION_OPENSKY_ENABLED`, `COLLECTION_ADSBFI_ENABLED`). Anything marked `TBD` has not been decided or produced yet.

See the [roadmap](ROADMAP.md) for the steps and next actions.

## Features

- Search for and view aircraft information
- Analyse observations and flight parameters (position, altitude, speed, heading)
- Reconstruct trajectories and display them on a map
- Detect unusual behaviour with a business rules engine (rules R1 to R5)
- Generate and store alerts
- Provide a supervision dashboard
- Analyse the aeronautical and geospatial data collected
- Replay historical traffic (PRC Data Challenge 2024) through the same rules, with a Live / Replay switch
- Manage accounts and roles (User, Supervisor)
- Optional bonus, not started: anomaly detection with machine learning, compared with the rules engine

## User profiles

| Profile | Purpose |
| --- | --- |
| User | Look up and analyse aeronautical data |
| Supervisor | Supervise aircraft, business rules and alerts through the dashboard |

## Tech stack

| Component | Technology | Status |
| --- | --- | --- |
| Data source | OpenSky Network, and adsb.fi in parallel | OpenSky is set by the project sheet; adsb.fi was added on 2026-11-20 (D-23) |
| Database | PostgreSQL 17 | Decided (the sheet says "such as PostgreSQL") |
| Backend / API | Python 3.11+, FastAPI | Set by the project sheet |
| ORM and migrations | SQLAlchemy 2.0 (async), Alembic | Decided |
| Frontend | React 19, TypeScript, Vite | Decided |
| Mapping | Leaflet (BSD-2-Clause), used directly without `react-leaflet` (D-01) | In place |
| Versioning | Git, hosted on GitHub | In place |
| CI/CD | GitHub Actions | CI in place, deployment not started |
| Containers | Docker | Set by the project sheet |
| Python tests and linting | pytest (asyncio, cov, xdist), ruff; minimum 80% coverage | Decided |
| Frontend tests | Vitest, Testing Library, Playwright; minimum 80% coverage | Decided |
| Cache | Redis | Deferred, only if needed |
| AI module (bonus) | Python machine learning library, `TBD` | Open |

The reasoning behind each choice is in [technology choices](docs/technology-choices.md).

## Getting started

With Docker and Docker Compose installed:

```bash
cp .env.example .env   # then replace the passwords and AUTH_JWT_SECRET
docker compose up --build
```

The application is then at `http://localhost:8888` and the API documentation at `http://localhost:8888/api/docs`. The steps, the default Supervisor account and the settings are in [installation and configuration](docs/installation.md).

## Documentation

| Document | Content |
| --- | --- |
| [Roadmap](ROADMAP.md) | Steps, deliverables, next actions |
| [Contributing](CONTRIBUTING.md) | Coding, commit, testing and documentation rules |
| [Requirements](docs/requirements.md) | Scope, requirements, user profiles, use cases |
| [Business rules](docs/business-rules.md) | Rules R1 to R5 and alert format |
| [OpenSky Network](docs/opensky.md) | Data source terms of use, access, fields and collection constraints |
| [Data sources](docs/data-sources.md) | OpenSky and adsb.fi compared: pace, freshness, precision, coverage, volume, and the terms of adsb.fi |
| [Historical data](docs/historical-data.md) | Sources explored to replay past traffic, the import of the PRC Data Challenge 2024 dataset and the replay mode (D-20) |
| [Data model](docs/data-model.md) | Entities, tables and columns |
| [Database conventions](docs/database-conventions.md) | Naming, keys, types, indexes, timestamps, migrations, security, checklist |
| [Architecture](docs/architecture.md) | Components, constraints, UML diagrams |
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

No open-source licence has been chosen, and the supervising teacher said none is needed (reported on 2026-11-20). The project sheet says nothing about intellectual property. The terms in [project terms](docs/project-terms.md) come from the specifications and are informative only.
