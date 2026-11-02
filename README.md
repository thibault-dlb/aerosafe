# AeroSafe

Intelligent application for monitoring and analysing aeronautical data.

AeroSafe is the capstone project ("projet fil rouge") of the Software Engineering and DevOps course ("Génie Logiciel et Développement Opérationnel") at IPSA, academic year 2026-2027. It uses public data from the OpenSky Network to track aircraft, reconstruct their trajectories and detect unusual situations.

> **Disclaimer:** AeroSafe is an educational project. It is not a certified air traffic surveillance or management system and must not be used operationally.

## Status

No application code has been written yet. The repository currently holds the reference documents and the project documentation. Anything marked `TBD` has not been decided or produced yet.

See the [roadmap](ROADMAP.md) for milestones and next steps.

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
| Supervisor | Supervise aircraft, business rules and alerts through the dashboard; manage accounts and roles |

## Tech stack

| Component | Technology | Status |
| --- | --- | --- |
| Data source | OpenSky Network | Set by the specifications |
| Database | PostgreSQL | Set by the specifications |
| Backend / API | Python, FastAPI | Set by the specifications |
| Frontend | React, TypeScript | Decided |
| Mapping | Open-source library, `TBD` | Open |
| Versioning | Git, hosted on GitHub | In place |
| CI/CD | `TBD` | Open |
| Containers | Docker | Set by the specifications |
| Python tests and linting | pytest, ruff | Decided |
| AI module (bonus) | Python machine learning library, `TBD` | Open |

The reasoning behind each choice is in [technology choices](docs/technology-choices.md).

## Getting started

`TBD`: there is nothing to install or run yet.

The application must eventually start from a single documented command, using containers, on a machine with no prior setup. See [installation and configuration](docs/installation.md).

## Documentation

| Document | Content |
| --- | --- |
| [Roadmap](ROADMAP.md) | Steps, milestones, deliverables, next actions |
| [Contributing](CONTRIBUTING.md) | Coding, commit, testing and documentation rules |
| [Requirements](docs/requirements.md) | Scope, requirements, user profiles, use cases |
| [Business rules](docs/business-rules.md) | Rules R1 to R5 and alert format |
| [Data model](docs/data-model.md) | Planned entities |
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
| [Open points](docs/open-points.md) | Contradictions in the specifications and pending decisions |

The reference documents are in French and prevail over the English documentation in this repository:

- [Specifications](Cahier_Des_Charge_Projet_Fil_Rouge.pdf) (Cahier des charges, version 1.0, 14 September 2026)
- [Project sheet](Fiche_projet_AeroSafe_IPSA.pdf) (Fiche de projet)

## Team

Thibault, Jules, Yassine, Sacha and Louis-Amaury.

Supervising teacher: Sirine SBOUI.

## Ownership and licence

No open-source licence has been chosen. The code and documentation remain the intellectual property of the project group members, and IPSA holds a non-exclusive right to use the deliverables for teaching purposes. See [project terms](docs/project-terms.md).
