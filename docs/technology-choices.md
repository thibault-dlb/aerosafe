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
| PostGIS with SQLAlchemy | GeoAlchemy2 | Decided on 2026-11-07 | Maintained library for the `GEO_POSITION` column |
| Scheduler | APScheduler | Decided on 2026-11-07 | Scheduled tasks run inside the API process, so no extra container is needed |
| Python tests and linting | pytest, ruff | Decided on 2026-11-02 | No detailed assessment recorded |
| Frontend linting | ESLint with typescript-eslint | Decided on 2026-11-03 | Marine Nationale standard |
| Gateway | Nginx | Decided on 2026-11-03 | Marine Nationale standard |
| Package managers | uv (Python), pnpm (frontend) | Decided on 2026-11-03 | Marine Nationale standard |
| Python test plugins | pytest-asyncio, pytest-cov, pytest-xdist | Decided on 2026-11-03 | See below |
| Frontend tests | Vitest and Testing Library (unit), Playwright (end to end) | Decided on 2026-11-03 | See below |
| Authentication | Built in the API: FastAPI, short-lived JWT, refresh token, argon2id | Decided on 2026-11-03 | The project sheet lists it as a development task, see below |
| Cache | Redis | Deferred | Adopted only if a need appears, see below |
| Mapping library | Leaflet (BSD-2-Clause) | Decided on 2026-11-03, scored grid added | See below. Used directly, without the react-leaflet wrapper (licence) |
| CI/CD tool | GitHub Actions | Decided on 2026-11-03, scored grid added | See below |
| Interface design | `TBD` | To decide (Thibault), D-19 | See below. The front has no stylesheet yet |
| AI library (bonus) | `TBD` | Postponed | To be decided when the module starts |

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

On 2026-11-03 the team chose to build authentication in the API. An identity provider (Keycloak) was considered first and dropped, because the project sheet lists "authentication and role management" among the development tasks (step 3, A-06).

| Topic | Choice | Notes |
| --- | --- | --- |
| Passwords | argon2id | OWASP recommendation; never stored or logged in clear text (NF-02) |
| Access token | JWT, valid about 15 minutes | Signed by the API; carries the user identifier and the role |
| Refresh token | Opaque random value in an `HttpOnly` cookie | Only its hash is stored in the database, so it can be revoked (logout, deactivated or anonymised account) |
| API | FastAPI security utilities, JWT handled with a maintained library | PyJWT, since `python-jose` is no longer actively maintained |
| Frontend | Login form, access token kept in memory | Refreshed silently through the cookie before it expires |
| Roles | `User` and `Supervisor`, from the `R_ROLE` reference table | Read from the token and checked by each restricted endpoint (BF-02) |

**Consequences:**

- The application owns the account lifecycle: sign-up (role `User`), login, logout, role change and deactivation by the Supervisor (BF-14, C-02).
- Account deletion is an anonymisation, never a physical delete (C-05). See [database conventions](database-conventions.md) §10.
- Throttling of failed logins and password rules must be implemented and tested.
- No identity provider container is needed. The JWT is verified with a secret held in the environment, so this choice does not require Redis.

## Mapping library: Leaflet

Scores from 1 (poor) to 5 (excellent), weighted with the grid. Total out of 5. The scores are one member's assessment: the "Team skills" row must be confirmed by the group.

| Criterion | Weight | Leaflet | MapLibre GL JS | OpenLayers |
| --- | --- | --- | --- | --- |
| Functional fit | 25% | 4: markers, lines (trajectories), popups | 5: also 3D and vector tiles | 5: very complete GIS features |
| Team skills | 20% | 5: simplest API, many tutorials | 3: more concepts to learn | 2: steep learning curve |
| Stack integration | 15% | 4: plain JavaScript library, usable from a TypeScript class | 4: React wrappers exist | 4: no official React wrapper |
| Maturity and support | 15% | 5: widely used since 2011 | 4: active, younger | 4: mature, smaller community |
| Cost and licence | 15% | 5: free, BSD-2-Clause | 5: free, BSD-3-Clause | 5: free, BSD-2-Clause |
| Portability and deployment | 10% | 5: bundled in the static build | 5: bundled in the static build | 5: bundled in the static build |
| **Weighted total** | | **4.60** | 4.30 | 4.10 |

**Why Leaflet:** it covers what AeroSafe needs (aircraft markers, trajectory lines, popups with flight data, BF-07) with the simplest learning curve, which matters most given the deadlines. Map tiles come from OpenStreetMap, whose data is under the ODbL: the credit "OpenStreetMap contributors" must be shown on the map. The public tile servers are not meant for heavy traffic, so they are fine for a demonstration but a tile provider would be needed beyond it.

**Trade-off:** no 3D view. If a 3D trajectory view is wanted later, MapLibre GL JS is the fallback.

**Licence point (settled):** the team chose Leaflet "with react-leaflet" on 2026-11-03. Leaflet is BSD-2-Clause, but `react-leaflet` 5.0.0 and `@react-leaflet/core` 3.0.0 are published under the Hippocratic License 2.1. That is an ethical-source licence: it is not an OSI-approved open-source licence and it restricts some uses. The specifications ask for an open-source mapping library and for libraries that allow redistribution of the source code (§IV.2, §VII.3). Decision: use Leaflet directly, wrapped in one TypeScript class (for example a map service that draws markers and trajectories) called from a small React component. This also fits the rule that everything outside components uses classes. Record the final choice and its licence in [dependencies](dependencies.md).

## CI/CD tool: GitHub Actions

Same scale and weights as above.

| Criterion | Weight | GitHub Actions | GitLab CI | Jenkins |
| --- | --- | --- | --- | --- |
| Functional fit | 25% | 5: runs tests on every push and pull request | 4: needs the repository mirrored to GitLab | 4: everything possible, more to configure |
| Team skills | 20% | 4: YAML file, many examples | 3: YAML, new platform | 2: server administration |
| Stack integration | 15% | 5: built into GitHub, ready-made Python, Node and Docker actions | 4: Docker-based | 4: plugins |
| Maturity and support | 15% | 5 | 5 | 5 |
| Cost and licence | 15% | 5: free and unlimited minutes for public repositories | 4: free monthly minutes | 5: free, but needs a server |
| Portability and deployment | 10% | 5: hosted, nothing to install | 5: hosted | 3: server to host and maintain |
| **Weighted total** | | **4.80** | 4.05 | 3.80 |

**Why GitHub Actions:** the repository is already on GitHub, so CI runs next to the pull requests with nothing to install, and the pipeline is a YAML file versioned with the code. A workflow in `.github/workflows/` runs on every push and every pull request, since the specifications want the tests run on every change (§VII.1):

- backend: `ruff check` and `pytest` with the 80% coverage threshold;
- frontend: `pnpm lint`, `pnpm typecheck` and `pnpm test:unit` with the 80% coverage threshold;
- end-to-end tests (Playwright) and the Docker build.

**Trade-off:** while the repository was private, free minutes were limited, so the pipeline only ran on pull requests and on pushes to `develop` and `main`. Since 2026-11-09 the repository is public and GitHub-hosted runner minutes are free, so the pipeline runs on every push and checks more (formatting, production build, migration round trip, three browsers, CodeQL). The Docker build and the end-to-end tests still share one job so the images are built once. The workflows are in `.github/workflows/`, described in [testing](testing.md#continuous-integration).

## Interface design

Not decided yet. Thibault owns the design (see [team work split](team-split.md#interface)) and records each choice here, with its date, as it is made. Until then the front has no stylesheet, and every page shows plain HTML.

**What already constrains the choice:**

- NF-03 asks for a clear, intuitive interface suited to quickly reviewing flights and alerts, a readable map and a visual prioritisation of alerts ([requirements](requirements.md)).
- Components are functions and everything else is a TypeScript class, whatever styling approach is chosen (see [frontend](#frontend-react-with-typescript)).
- A new dependency goes in its own small pull request, with its licence in [dependencies](dependencies.md). The licence matters: the `react-leaflet` case (D-01) showed that a wrapper can be non-open-source.
- Other members build their pages with the shared elements and do not edit them.

**Choices to make:**

| Topic | Question | Decision |
| --- | --- | --- |
| Styling approach | Plain CSS, CSS modules, a utility framework or a component library | `TBD` |
| Design tokens | Colours, spacing, typography, shared by every page | `TBD` |
| Shared elements | Which base elements go in `components/ui/` (buttons, form fields, tables, badges, messages) | `TBD` |
| Alert criticality | How a level is shown at first glance, in a way that does not rely on colour alone | `TBD` |
| Map | Size, controls and legend of the Leaflet map, shared by the aircraft pages and the dashboard | `TBD` |
| Navigation | What the navigation shows before login, as a User and as a Supervisor | `TBD` |
| Home page | What the home page presents, including the educational disclaimer the specifications ask to show in the application (§VII.3) | `TBD` |
| Accessibility | Contrast, keyboard use, labels | `TBD` |
| Screen sizes | Desktop only, or also tablet and phone | `TBD` |
| Language of the interface | The texts are in English today; whether they stay so | `TBD` |
