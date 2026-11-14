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
| Interface design | Plain CSS with CSS modules, tokens in CSS variables, two themes, French by default with an English switch | Decided on 2026-11-12 (D-19) | See below |
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

Decided on 2026-11-12 (D-19). Thibault owns the design (see [team work split](team-split.md#interface)) and records each choice here, with its date. The identity (logo, colour themes, fonts) is in [brand guidelines](brand/brand-guidelines.md).

**What already constrains the choice:**

- NF-03 asks for a clear, intuitive interface suited to quickly reviewing flights and alerts, a readable map and a visual prioritisation of alerts ([requirements](requirements.md)).
- Components are functions and everything else is a TypeScript class, whatever styling approach is chosen (see [frontend](#frontend-react-with-typescript)).
- A new dependency goes in its own small pull request, with its licence in [dependencies](dependencies.md). The licence matters: the `react-leaflet` case (D-01) showed that a wrapper can be non-open-source.
- Other members build their pages with the shared elements and do not edit them.

**Choices:**

| Topic | Decision |
| --- | --- |
| Styling approach | Plain CSS. The tokens are CSS variables in a global file, and each component has its own `.module.css`. Vite handles CSS modules natively, so there is no dependency, and each member owns the style files of their own components |
| Design tokens | The two themes of [brand guidelines](brand/brand-guidelines.md#3-the-two-retained-themes): dark (Golden radar) by default and light (Papyrus), plus a spacing scale, radii and a type scale. No component uses a literal colour. The theme follows the system setting and a switch in the top bar overrides it |
| Animation library | `gsap` (ScrollTrigger plugin) for the scene of the home page only. Simple fades use `IntersectionObserver` and CSS transitions, and the counters a `requestAnimationFrame` loop |
| Fonts | Cinzel, Inter and JetBrains Mono, installed locally with `@fontsource-variable/*` (own pull request, licence in [dependencies](dependencies.md)) |
| Logo | Eye of Horus with a radar pupil, in [brand guidelines](brand/brand-guidelines.md#1-logo). It is placed in the navigation frame, on the home page and as the page icon |
| Shared elements | `Button`, `Panel`, `StatTile`, `StatusBadge`, `Notice`, `Field` (with an optional icon and end control), `Fold` and `Icon` in `components/ui/` |
| Icons | Drawn by hand, as inline SVG: thin outlines with round ends on a 24 by 24 grid, the same drawing as the logo, in the colour of the text around them (`IconSet`, 25 icons). No dependency, so no licence to record |
| Alert criticality | A badge with a shape, a colour and a label, never colour alone: round dot for low, triangle for medium (warning orange), diamond for high (danger) |
| Map | Colours come from the `--map-*` tokens: altitude as shades of gold, selected aircraft and trajectory in the primary colour. Dark tiles are still an open point |
| Navigation | Three frames. The home page, and the page for an address that leads nowhere, share a landing frame: a bar with the logo, the data source, the language, the theme and the way in (it floats over the scene on the home page and turns solid once the page scrolls). The log in and sign up screen has its own (see below). Every other page lives in the shell: a side bar on the left with the pages the role gives access to (a User sees the dashboard and the aircraft, a Supervisor also the alerts, the rules and the accounts, with the number of active alerts as a badge), and at its foot the account (avatar, e-mail, role with a shape) and the way out; a thin top bar with the name of the page, the data source, the language and the theme. The side bar folds into a rail of icons, and the choice is remembered. On a phone it is a drawer opened from the top bar and closed by a link, the backdrop or the Escape key. In the replay the replay bar sits under the top bar |
| Home page | A landing page, always dark (a `darkScope` class redefines the dark tokens whatever the theme), that does not mention the educational project apart from the footer line. A scene plays as the page scrolls (an aircraft crosses France and rule R3 raises an alert; drawn in SVG, driven by GSAP ScrollTrigger and the pure `FlightTimeline` class, still with `prefers-reduced-motion`). Under it: the features, four figures taken from the documentation, how it works, and a call to action. The educational disclaimer (§VII.3) is in the footer of every page and, as a notice, on the log in and sign up pages |
| Log in and sign up | One screen for both, at `/login` and `/signup`, without the site bar. Three layers: the brown ground, the radar of France with its edges melted into the ground, and the form above. Going from one mode to the other swaps the two panels and the radar slides under the form without stopping (the screen and the radar stay mounted when the route changes). The screen is always dark, like the home page. Password: show or hide, a gauge that fills up to the 12 characters the API asks for (no made up strength), a Caps Lock warning. After a sign up the visitor is logged in at once and welcomed. Only `/`, `/login` and `/signup` are public; every other page needs a login, and the supervision pages a Supervisor |
| Page not found | Told as an alert of rule R1: an aircraft whose contact was lost. A radar screen, always dark, where the track stops at the last known position and the rest of the route blinks; the address asked for is shown as a callsign. It leads back to the home page, or to the dashboard when logged in |
| Access restricted | A User who opens a supervision page sees a lock, a sentence and a way back to the dashboard, inside the shell |
| Loading | While the session is restored, the eye of the logo is drawn in gold and its radar pupil starts to sweep |
| Accessibility | Text contrast of 4.5:1 at least (values in the brand guidelines), visible keyboard focus, labelled fields, `prefers-reduced-motion` respected |
| Screen sizes | Responsive: desktop first, phone second, tablet least important |
| Language of the interface | French by default with an English switch, through a home-made `TranslationService` and two typed dictionaries, without a library. The choice is kept in the browser |
