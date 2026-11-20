# Installation and configuration

The application runs from the container stack (PostGIS, API, front and Nginx gateway). The deployment environment and the troubleshooting section are still `TBD`.

## Requirements for the procedure

Source: project sheet step 8; specifications §VII.1, §VIII.2 and §IX.2 for the single-command and clean-machine requirements.

- The whole application is launched through containers (Docker), with no manual dependency installation.
- It runs from a single documented command, on a machine with no prior setup.
- The installation must succeed on a clean environment using only the documentation provided.

## Prerequisites

- Docker with Docker Compose.
- For development outside containers: Python 3.11+ with [uv](https://docs.astral.sh/uv/), and Node.js with [pnpm](https://pnpm.io/).

## Installation

1. Copy `.env.example` to `.env` and replace the passwords and `AUTH_JWT_SECRET`. The API refuses to start with the example JWT secret; generate one with `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
2. Sign in with the default administrator account, a Supervisor created by the migrations: `admin@aerosafe.com`, password `admin`. This credential is public: change its password, or deactivate the account, before exposing an installation to anyone else.
3. Other Supervisors: sign-up only creates User accounts, so promote one from the command line. The command asks for the password, or promotes the account if the e-mail is already registered:

   ```bash
   docker compose exec api python -m services.auth.cli chief@example.com
   ```

## Launch

```bash
docker compose up --build
```

The application is then available at `http://localhost:8888`. The API documentation is at `http://localhost:8888/api/docs`.

## Development without containers

```bash
cd src/api && uv sync --all-groups && uv run uvicorn main:app --reload
cd src/front && pnpm install && pnpm dev
```

## Configuration

Secrets such as database credentials, API keys and environment variables are never committed. They are managed through an environment file excluded from version control (§V.2).

| Variable | Purpose | Required | Default |
| --- | --- | --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | PostgreSQL administrator, used to create the application database | Yes | None |
| `DB_HOST`, `DB_PORT` | Where the API finds the database | Yes | `postgres`, `5432` in the template |
| `DB_USER`, `DB_PASS`, `DB_NAME` | Application database and its user, limited to reading and writing data | Yes | None |
| `DB_MIGRATION_USER`, `DB_MIGRATION_PASS` | Owner of the application database, used only to run the migrations | Yes | None |
| `AUTH_JWT_SECRET` | Secret that signs the access tokens: 32 characters at least, and not the value of `.env.example` | Yes | None (the example value is refused) |
| `AUTH_ACCESS_TOKEN_MINUTES`, `AUTH_REFRESH_TOKEN_DAYS` | Lifetime of the access token and of the refresh token | No | `15`, `7` |
| `AUTH_COOKIE_SECURE` | `true` behind HTTPS; `false` lets the refresh cookie work over plain HTTP | No | `false` |
| `AUTH_LOGIN_MAX_FAILURES`, `AUTH_LOGIN_LOCK_MINUTES` | Throttling of failed logins | No | `5`, `15` |
| `COLLECTION_ENABLED` | Starts the OpenSky collection. Keep `false` unless this instance is the only one to collect with the group account | No | `false` |
| `COLLECTION_PROFILE` | `ILE_DE_FRANCE` (every 30 s, 1 credit) or `FRANCE` (every 120 s, 3 credits) | No | `ILE_DE_FRANCE` |
| `COLLECTION_FLIGHT_GAP_MINUTES` | Maximum gap between two observations of the same flight | No | `30` |
| `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` | OAuth2 API client of the group account; empty means anonymous access (400 credits a day) | No | Empty |
| `VITE_API_URL` | Public URL of the API, as seen from the browser | No | `http://localhost:8888/api` |

## Environments

The project covers development and deployment environments (step 8 of the [roadmap](../ROADMAP.md)). Their details are `TBD`.

## Troubleshooting

`TBD`.
