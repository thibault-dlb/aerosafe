# Team work split

How the development of AeroSafe is shared between the five group members. This is a team decision, not a requirement of the [project sheet](../Fiche_projet_AeroSafe_IPSA.pdf). BF, NF and UC codes come from [requirements](requirements.md) and are not binding. Git rules are in [contributing](../CONTRIBUTING.md).

The split was made without information on each member's skills. Work packages can be swapped between members: only the names change.

## Principles

- **Split by feature.** Each member delivers a work package end to end: API, interface, tests and documentation.
- **One owner per file.** You read other members' code, you do not change it.
- **Shared files are prepared once.** Thibault sets them up in the foundation, so nobody has to edit them afterwards.

## Work packages

| Member | Branch | Scope | Requirements | Use cases |
| --- | --- | --- | --- | --- |
| Thibault (lead) | `feat/data-foundation`, then `chore/ci-deployment` | Shared foundation, then CI, deployment and application monitoring; interface design and home page (see [interface](#interface)); review and merge of every pull request | Steps 7 to 9, NF-03, NF-07 | None |
| Louis-Amaury | `feat/auth-accounts` | Sign-up, login, roles, account management and anonymisation | BF-01, BF-02, BF-14 | UC-06, UC-09, UC-10, UC-11 |
| Jules | `feat/collection-dashboard` | OpenSky collection, flight grouping, scheduler, supervision dashboard | BF-03, BF-11 | UC-08 |
| Sacha | `feat/rules-alerts` | Rules engine R1 to R5, alerts, thresholds | BF-09, BF-10, BF-12, BF-13 | UC-03, UC-04, UC-05 |
| Yassine | `feat/aircraft-lookup` | Search, aircraft record, flight parameters, trajectory, map, flight statistics | BF-04 to BF-08 | UC-01, UC-02 |

The AI module (BF-15, UC-07) is **not assigned**. It is a bonus and only starts once all priority E requirements are met.

## File ownership

| Member | Backend (`src/api/`) | Frontend (`src/front/src/`) |
| --- | --- | --- |
| Thibault | `models/`, `database/migrations/`, `core/`, `routes/router.py`, `main.py`, `pyproject.toml` | `AppRoute.tsx`, `App.tsx`, `services/ApiClient.ts`, `components/layout/`, `pages/Home.tsx`, the global styles and `components/ui/` (design, see [interface](#interface)), `../package.json` |
| Louis-Amaury | `routes/v1/auth.py`, `routes/v1/users.py`, `services/auth/`, `schemas/auth.py`, `schemas/user.py`, `config/auth.py` | `pages/auth/`, `pages/admin/`, `components/auth/`, `assets/logo/`, `providers/AuthProvider.tsx`, `hooks/useAuth.ts`, `services/AuthService.ts`, `models/User.ts` |
| Jules | `routes/v1/collection.py`, `routes/v1/dashboard.py`, `services/collection/`, `schemas/collection.py`, `schemas/dashboard.py`, `config/opensky.py` | `pages/dashboard/`, `components/dashboard/`, `services/DashboardService.ts` |
| Sacha | `routes/v1/rules.py`, `routes/v1/alerts.py`, `services/rules/`, `services/alerts/`, `schemas/rule.py`, `schemas/alert.py` | `pages/alerts/`, `pages/rules/`, `components/alerts/`, `services/AlertService.ts`, `services/RuleService.ts`, `models/Alert.ts`, `models/Rule.ts` |
| Yassine | `routes/v1/aircraft.py`, `routes/v1/flights.py`, `services/aircraft/`, `services/flights/`, `schemas/aircraft.py`, `schemas/flight.py` | `pages/aircraft/`, `pages/flights/`, `components/map/`, `services/MapService.ts`, `services/AircraftService.ts`, `models/Aircraft.ts`, `models/Flight.ts` |

Tests and documentation follow the same rule:

- Each member owns the test files named after their domain: `tests/unit/test_<domain>_*.py`, `tests/api/test_<domain>_*.py`, `e2e/<domain>.spec.ts`, and frontend unit tests next to their own code.
- Each member owns their section of `docs/api.md` and their part of `docs/user-guide.md`.
- The test cases of rules R1 to R5 belong to Sacha.
- Thibault owns `.github/`, `docker-compose.yaml`, `src/nginx/`, `ROADMAP.md`, `docs/open-points.md` and `CONTRIBUTING.md`.

## Interface

The split above already gives each member the pages of their work package. This section records where the interface stands and who finishes what, as a team decision made on 2026-11-10 (not a requirement of the project sheet). Thibault takes the design and the home page; the four other members build their own screens and style them with Thibault's design.

### State on 2026-11-10

| Screen | Route | Owner | State |
| --- | --- | --- | --- |
| Home | `/` | Thibault | Built on `feat/landing-page`: a dark landing page with a scroll-driven scene, the features, figures, steps and a call to action. The live figures and the map moved to the top of the dashboard |
| Log in, sign up | `/login`, `/signup` | Louis-Amaury | Built (done with Thibault on `feat/auth-session` and `feat/auth-screens`): one shared screen, `AuthProvider`, `useAuth`, `AuthService`, the route guards and the session renewal of `ApiClient`. The two empty pages `pages/auth/Login.tsx` and `SignUp.tsx` are gone: the screen is `components/auth/AuthScreen.tsx` |
| Accounts, my account | `/admin/accounts`, `/account` | Louis-Amaury | Built with their tests: the table of accounts with a search, roles, activation, anonymisation after a typed word and creation with a provisional password shown once (`components/accounts/`); the account page, open to every role, with the password, the preferences (language, units) and the deletion of the account (`components/account/`); the screen that replaces a provisional password (`components/auth/ChangePassword`, shown by `RequireAuth`). The API is `routes/v1/users.py`, `services/users/` and `POST /auth/password` (see [API](api.md#accounts-apiv1users)). Only the Supervisor sees the list; the account page is in the shell for everyone |
| Dashboard | `/dashboard` | Jules | Built with its tests, open to every role (`pages/dashboard/`, `components/dashboard/`, `services/DashboardService.ts`): the four figures, the map filling the screen (a drawn dark base map, every aircraft carried forward between two reports and turned along their heading, coloured by the criticality of their active alert, a line for their next 15 minutes, and the follow of one aircraft with its card and its whole flight: `components/map/TrafficMap.tsx`, `services/TrafficLayer.ts`, `components/dashboard/TrackedAircraft.tsx`), the latest active alerts (`AlertTable`, with "Traiter" for a Supervisor only; a click centres the map on the aircraft of the alert, a second one opens it in the alerts page through `?alert=<id>`, read by `pages/alerts/Alerts.tsx`), the chart of alerts per rule (stacked bars in SVG, no library, with a data table), and the state of the collection with the Supervisor's controls (`CollectionService`). `LiveOverview` is gone: the dashboard replaced it. The API is `routes/v1/dashboard.py` and `services/dashboard/` (see [API](api.md#dashboard-apiv1dashboard)) |
| Alerts, rules | `/alerts`, `/rules` | Sacha | Built and styled with the shared elements (chips, sortable table, detail panel, notifications; one card for each rule), translated, with their tests; inside the shell, closed to a User. `components/alerts/` and `components/rules/` hold their parts |
| Aircraft search, aircraft record, flight | `/aircraft`, `/aircraft/:id`, `/flights/:id` | Yassine | Built and styled with the shared elements, translated, with their tests: one search field and an area drawn on the map, an identity banner with figures, a large map with oriented markers, profiles read by pointing. `components/aircraft/` holds the banner and the small marker of the lists |

The front has no stylesheet yet: every page shows plain HTML. The design is decided (D-19, 2026-11-12) and is being built on `feat/interface-design`; it lands before the other pages are styled.

### Who does what

| Member | Interface work left |
| --- | --- |
| Thibault | The design (global styles, shared base elements, navigation frame, see below) and the home page. Wires the route guard of Louis-Amaury in `AppRoute.tsx` |
| Louis-Amaury | The logo (design and files), then `AuthProvider`, `useAuth`, `AuthService`, `User` model, the token provider of `ApiClient`, a route guard by role in `components/auth/`, the log in, sign up and accounts pages. The accounts page needs `users.py` first |
| Jules | The dashboard page, `components/dashboard/` and `DashboardService`. The page needs `dashboard.py` first, and reuses `AlertTable` and the map (see the contracts below) |
| Sacha | Style the alerts and rules pages with the design, and make the criticality of an alert visible at first glance (NF-03) |
| Yassine | Style the aircraft and flight pages with the design, and keep the map readable (NF-03) |

### Design

- **Owner.** Thibault owns the global styles, the design tokens (colours, spacing, typography), the shared base elements in `components/ui/` and the navigation frame in `components/layout/`. The choices are recorded in [technology choices](technology-choices.md#interface-design).
- **Use.** The other members build their pages with these elements and do not edit them, following the one-owner rule. A missing element is asked from Thibault, who adds it in a small pull request.
- **Logo.** Louis-Amaury designs the logo and owns its files in `src/front/src/assets/logo/` (a folder to create). Thibault then places it in the navigation frame, on the home page and as the page icon in `index.html`, and its colours follow the design tokens, so the two stay consistent.
- **Order.** Nobody waits for the design to build a screen: a screen works unstyled and takes the design when it is merged.

## Foundation content

The foundation is what prevents conflicts. It is merged **before** anyone else starts. It contains:

- every SQLAlchemy model and Alembic migration derived from `db/schema.sql`, plus the reference data, including R1 to R5;
- one empty routes file per work package, already included in `routes/router.py`;
- one empty page per work package, already declared in `AppRoute.tsx`, with the navigation;
- a completed `ApiClient`, which only handles GET today: it also needs POST, PATCH, DELETE and the access token;
- the predictable dependencies: Leaflet (without `react-leaflet`, see D-01 in [open points](open-points.md)), argon2id, PostGIS support for SQLAlchemy, a scheduler, and a replacement for `python-jose`, which is no longer actively maintained;
- reserved sections in `.env.example` and `docs/api.md`;
- the frozen signatures of the contracts below, as empty implementations.

## Contracts between work packages

These are the only contact points. The owner implements them. The others call them without changing the file.

| Contract | Owner | Used by |
| --- | --- | --- |
| `get_current_user`, `require_role(...)` in `core/security.py` | Signature: Thibault. Implementation: Louis-Amaury, the only exception to `core/` | Every API work package |
| Token provider of `ApiClient` | Louis-Amaury | Every frontend work package |
| `useAuth` and the route guard in `components/auth/` | Louis-Amaury | Thibault's navigation frame (log in or log out, links allowed for the role) and `AppRoute.tsx` |
| `components/ui/` and the global styles | Thibault | Every frontend work package |
| `Scheduler.start()`, `Scheduler.stop()` in `services/collection/scheduler.py` | Jules | `main.py`, at application start and stop |
| `RulesEngine.evaluate(now)` | Sacha | Jules's scheduler, right after each collection |
| `AlertService.statistics()` | Sacha | Jules's dashboard, which does not query `ALERTE` directly |
| `components/alerts/AlertTable` | Sacha | Jules's dashboard |
| `components/map/` and `MapService` | Yassine | Jules's dashboard |

## Working rules

- **Branches.** Create them from an up-to-date `develop`. Open pull requests to `develop`, approved by Thibault only. Never push to `main` or `develop`.
- **After a merge.** The branch is deleted, then created again from `develop` if the work package continues. Each member has one active branch at a time.
- **Short pull requests.** One feature per pull request, to limit conflicts.
- **Models.** `src/api/models/` only holds columns and relationships. Logic such as marking an alert as processed goes in the services of the work package. Read through `core/repository.py`, which skips soft-deleted rows.
- **Need something in another member's area?** Ask its owner. Any schema change goes through Thibault, which avoids competing migrations.
- **New dependency.** Add it in its own small pull request, with its licence in [dependencies](dependencies.md).
- **Commit scopes.** `data`, `api`, `front`, `auth`, `collection`, `dashboard`, `rules`, `alerts`, `aircraft`, `flights`, `ci`.

## Order of work

1. Thibault merges `feat/data-foundation`. Everything else depends on it.
2. In parallel: Louis-Amaury, Jules (collection), Sacha, Yassine, and Thibault on `chore/ci-deployment`. Sacha and Yassine work on test data until the collection is merged.
3. Jules finishes the dashboard once `AlertTable` and the map are merged.
4. Deliverables 1 and 3: each member provides their part, and Thibault assembles them.

## Points to keep in mind

- Thibault has two successive branches, because the foundation is a `feat/` branch and CI must be a `chore/` branch. They are never active at the same time.
- GitHub does not let an author approve their own pull request. Once `develop` is locked, the pull requests of Thibault need either another reviewer or an administrator exception.
