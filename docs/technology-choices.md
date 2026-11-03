# Technology choices

Every technology chosen needs a written justification in the design documentation and is presented at the defence (project sheet: technology choices are part of deliverables 1 and 3).

## Selection grid

Technical and organisational choices are judged against these weighted criteria. The grid itself comes from the specifications (§IV.2); the project sheet defines none. It is also used to settle points the specifications leave open: frontend framework, mapping library and CI tool.

| Criterion | Weight | What is assessed |
| --- | --- | --- |
| Functional fit | 25% | Coverage of BF-01 to BF-14, ability to handle geospatial data |
| Team skills | 20% | Existing skills, learning curve compatible with the deadlines |
| Stack integration | 15% | Compatibility with Python, FastAPI, PostgreSQL and Docker |
| Maturity and support | 15% | Stability, documentation, community activity, longevity |
| Cost and licence | 15% | Free of charge, open-source licence compatible with educational use |
| Portability and deployment | 10% | Ease of containerising and reproducing environments |

## Summary

| Topic | Choice | Status | Basis |
| --- | --- | --- | --- |
| Data source | OpenSky Network | Set | Project sheet |
| Database | PostgreSQL | Decided | The project sheet says "such as PostgreSQL" |
| Backend / API | Python, FastAPI | Set | Project sheet (FastAPI) |
| Versioning | Git | Set | Project sheet (step 6) |
| Containers | Docker | Set | Project sheet (step 8) |
| Frontend | React 19, TypeScript, Vite | Decided on 2026-11-02 | See below |
| ORM | SQLAlchemy 2.0 (async) with asyncpg | Decided on 2026-11-03 | See below |
| Database migrations | Alembic | Decided on 2026-11-03 | See below |
| Python tests and linting | pytest, ruff | Decided on 2026-11-02 | No detailed assessment recorded |
| Frontend linting | ESLint with typescript-eslint | Decided on 2026-11-03 | Marine Nationale standard |
| Gateway | Nginx | Decided on 2026-11-03 | Marine Nationale standard |
| Package managers | uv (Python), pnpm (frontend) | Decided on 2026-11-03 | Marine Nationale standard |
| Python test plugins | pytest-asyncio, pytest-cov, pytest-xdist | Decided on 2026-11-03 | See below |
| Frontend tests | Vitest and Testing Library (unit), Playwright (end to end) | Decided on 2026-11-03 | See below |
| Authentication | Keycloak, OpenID Connect (authorization code flow) | Decided on 2026-11-03 | Marine Nationale standard, see below |
| Cache | Redis | Deferred | Adopted only if a need appears, see below |
| Mapping library | `TBD` | Open | Must be open source; use the grid |
| CI/CD tool | `TBD` | Open | Use the grid |
| AI library (bonus) | `TBD` | Open | Python machine learning library |

## Frontend: React with TypeScript

The options were compared qualitatively against the grid. No numeric score was calculated.

| Criterion | React + TypeScript | Angular | Vue.js + TypeScript | NiceGUI |
| --- | --- | --- | --- | --- |
| Functional fit | Map and dashboard possible | Map and dashboard possible | Map and dashboard possible | Possible, with less room for customisation |
| Team skills | At least one member already knows it | Not reported | Not reported | Not assessed |
| Stack integration | Consumes the FastAPI REST API | Consumes the FastAPI REST API | Consumes the FastAPI REST API | Built on FastAPI |
| Maturity and support | High, very large ecosystem | High | High | Lower, younger project |
| Cost and licence | Free, MIT | Free, MIT | Free, MIT | Free, MIT |
| Portability and deployment | Static build served by a web server | Static build served by a web server | Static build served by a web server | Python container |
| Object-oriented style (project rule) | Weak for components | Strong: classes and dependency injection | Weak for components | Good: Python classes |

**Why React:** it is the only option with reported team experience, and it is mature with a very large ecosystem.

**Trade-off:** React's recommended style relies on functions and hooks, which fits the object-oriented rule poorly. To apply that rule anyway:

- components are functions, as React recommends;
- everything outside components (models, services, API client) uses TypeScript classes.

## Backend, database, ORM and tests

On 2026-11-03 the following choices were made. They were not compared against the grid: they follow the Marine Nationale standard stack. Versions are targets and are to be confirmed when installed.

| Topic | Choice | Notes |
| --- | --- | --- |
| Backend | Python 3.11+, FastAPI, asynchronous | Pydantic 2 for schemas |
| Frontend | React 19, TypeScript, Vite | Vite is the build tool |
| Database | PostgreSQL 17 | |
| ORM | SQLAlchemy 2.0 with asyncpg | Asynchronous sessions |
| Migrations | Alembic | One migration per schema change |
| Python tests | pytest with pytest-asyncio, pytest-cov and pytest-xdist | Minimum coverage of 80%, enforced (the test run fails below it). ruff is used for linting |
| Frontend unit tests | Vitest with Testing Library | Minimum coverage of 80%, enforced (the test run fails below it) |
| Frontend end-to-end tests | Playwright | |

**Cache (Redis 7.4):** No AeroSafe requirement needs a cache yet. It is adopted only if measured load on the OpenSky data or the dashboard requires it. Until then PostgreSQL is enough and no Redis container is added.

## Authentication

On 2026-11-03 authentication was delegated to an identity provider instead of being built in the API. It was not compared against the grid: it follows the Marine Nationale standard for authentication.

| Topic | Choice | Notes |
| --- | --- | --- |
| Identity provider | Keycloak | Open source (Apache 2.0), one realm for AeroSafe, run as a Docker container |
| Protocol | OpenID Connect, authorization code flow | The login page is the one provided by Keycloak |
| Frontend | `oidc-client-ts` | Tokens kept in `sessionStorage`, refreshed before they expire |
| API | FastAPI with `OAuth2AuthorizationCodeBearer`, JWT validated with `python-jose` | Signing keys (JWKS) fetched from Keycloak and cached in memory |
| Passwords | Hashed and stored by Keycloak | The API never sees a password (NF-02) |
| Roles | `User` and `Supervisor` realm roles | Read from the token and checked by each restricted endpoint (BF-02) |

**Consequences:**

- The API and the frontend need no password handling code and no login form.
- Account creation, deactivation and deletion (BF-14, C-02, C-05) can use the Keycloak administration console or API, so the answer to C-02 decides how much account management the application has to build.
- Keycloak adds a container and needs its own database schema, which can live in the same PostgreSQL server.
- The JWKS cache is held in memory, so this choice does not require Redis.
- The project sheet lists authentication and role management among the development tasks (step 3). Delegating them to Keycloak reduces that work to configuration and integration, which must be justified at the defence (A-06).

## Mapping library

`TBD`. The project sheet only requires trajectories to be shown on a map. The specifications add that the library must be open source and chosen with the grid.

## CI/CD tool

`TBD`. The repository is hosted on GitHub.
