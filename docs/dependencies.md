# Dependencies and licences

The project keeps an up-to-date list of its dependencies and their licences (§V.1). Only libraries whose licence allows educational use and redistribution of the source code may be used (§VII.3).

Nothing is installed yet. This table lists what has been chosen so far. Check each licence against the exact version when it is adopted.

| Component | Purpose | Version | Licence |
| --- | --- | --- | --- |
| FastAPI | Backend API | `TBD` | MIT |
| PostgreSQL | Database | 17 (target) | PostgreSQL License |
| PostGIS | Spatial extension for PostgreSQL (D-18) | 3.7 | GPL-2.0-or-later |
| SQLAlchemy | ORM | 2.0 (target) | MIT |
| asyncpg | Asynchronous PostgreSQL driver | `TBD` | Apache-2.0 |
| Alembic | Database migrations | `TBD` | MIT |
| React | Frontend | 19 (target) | MIT |
| TypeScript | Frontend language | `TBD` | Apache-2.0 |
| Vite | Frontend build tool | `TBD` | MIT |
| Vitest | Frontend unit tests | `TBD` | MIT |
| Testing Library | Frontend component tests | `TBD` | MIT |
| Playwright | Frontend end-to-end tests | `TBD` | Apache-2.0 |
| pytest | Python tests | `TBD` | MIT |
| pytest-asyncio | Async Python tests | `TBD` | Apache-2.0 |
| pytest-cov | Python coverage | `TBD` | MIT |
| pytest-xdist | Parallel Python tests | `TBD` | MIT |
| ruff | Python linting | `TBD` | MIT |
| Uvicorn | ASGI server | see `src/api/uv.lock` | BSD-3-Clause |
| Pydantic, pydantic-settings | Schemas and settings | see `src/api/uv.lock` | MIT |
| httpx | HTTP client, API tests | see `src/api/uv.lock` | BSD-3-Clause |
| Loguru | Logging | see `src/api/uv.lock` | MIT |
| uv | Python package manager | `TBD` | Apache-2.0 or MIT |
| React Router | Frontend routing | see `src/front/pnpm-lock.yaml` | MIT |
| ESLint, typescript-eslint | Frontend linting | see `src/front/pnpm-lock.yaml` | MIT |
| jsdom | DOM for frontend unit tests | see `src/front/pnpm-lock.yaml` | MIT |
| pnpm | Frontend package manager | 12 | MIT |
| Nginx | Gateway and static file server | 1.27 | BSD-2-Clause |
| Docker | Containers | `TBD` | `TBD` |
| Mapping library | Trajectory map | `TBD` | `TBD`, must be open source |

## Data source

OpenSky Network data remains subject to its own terms of use, which the project group must check and respect. See [project terms](project-terms.md).

## Reused code

External code reused in the project must be declared and attributed here.

| Source | Where it is used | Licence |
| --- | --- | --- |
| None yet | | |
