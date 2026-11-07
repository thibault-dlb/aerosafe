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
| Thibault (lead) | `feat/data-foundation`, then `chore/ci-deployment` | Shared foundation, then CI, deployment and application monitoring; review and merge of every pull request | Steps 7 to 9, NF-07 | None |
| Louis-Amaury | `feat/auth-accounts` | Sign-up, login, roles, account management and anonymisation | BF-01, BF-02, BF-14 | UC-06, UC-09, UC-10, UC-11 |
| Jules | `feat/collection-dashboard` | OpenSky collection, flight grouping, scheduler, supervision dashboard | BF-03, BF-11 | UC-08 |
| Sacha | `feat/rules-alerts` | Rules engine R1 to R5, alerts, thresholds | BF-09, BF-10, BF-12, BF-13 | UC-03, UC-04, UC-05 |
| Yassine | `feat/aircraft-lookup` | Search, aircraft record, flight parameters, trajectory, map, flight statistics | BF-04 to BF-08 | UC-01, UC-02 |

The AI module (BF-15, UC-07) is **not assigned**. It is a bonus and only starts once all priority E requirements are met.

## File ownership

| Member | Backend (`src/api/`) | Frontend (`src/front/src/`) |
| --- | --- | --- |
| Thibault | `models/`, `database/migrations/`, `core/`, `routes/router.py`, `main.py`, `pyproject.toml` | `AppRoute.tsx`, `App.tsx`, `services/ApiClient.ts`, shared layout, `../package.json` |
| Louis-Amaury | `routes/v1/auth.py`, `routes/v1/users.py`, `services/auth/`, `schemas/auth.py`, `schemas/user.py`, `config/auth.py` | `pages/auth/`, `pages/admin/`, `providers/AuthProvider.tsx`, `hooks/useAuth.ts`, `services/AuthService.ts`, `models/User.ts` |
| Jules | `routes/v1/collection.py`, `routes/v1/dashboard.py`, `services/collection/`, `schemas/collection.py`, `schemas/dashboard.py`, `config/opensky.py` | `pages/dashboard/`, `components/dashboard/`, `services/DashboardService.ts` |
| Sacha | `routes/v1/rules.py`, `routes/v1/alerts.py`, `services/rules/`, `services/alerts/`, `schemas/rule.py`, `schemas/alert.py` | `pages/alerts/`, `pages/rules/`, `components/alerts/`, `services/AlertService.ts`, `services/RuleService.ts`, `models/Alert.ts`, `models/Rule.ts` |
| Yassine | `routes/v1/aircraft.py`, `routes/v1/flights.py`, `services/aircraft/`, `services/flights/`, `schemas/aircraft.py`, `schemas/flight.py` | `pages/aircraft/`, `pages/flights/`, `components/map/`, `services/MapService.ts`, `services/AircraftService.ts`, `models/Aircraft.ts`, `models/Flight.ts` |

Tests and documentation follow the same rule:

- Each member owns the test files named after their domain: `tests/unit/test_<domain>_*.py`, `tests/api/test_<domain>_*.py`, `e2e/<domain>.spec.ts`, and frontend unit tests next to their own code.
- Each member owns their section of `docs/api.md` and their part of `docs/user-guide.md`.
- The test cases of rules R1 to R5 belong to Sacha.
- Thibault owns `.github/`, `docker-compose.yaml`, `src/nginx/`, `ROADMAP.md`, `docs/open-points.md` and `CONTRIBUTING.md`.

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
