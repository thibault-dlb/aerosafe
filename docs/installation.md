# Installation and configuration

Only the project foundations exist so far: an API with a health check, an empty web interface and the container stack. This page will be completed as the application grows.

## Requirements for the procedure

Source: specifications §VII.1, §VIII.2 and §IX.2.

- The whole application is launched through containers (Docker), with no manual dependency installation.
- It runs from a single documented command, on a machine with no prior setup.
- The installation must succeed on a clean environment using only the documentation provided.

## Prerequisites

- Docker with Docker Compose.
- For development outside containers: Python 3.11+ with [uv](https://docs.astral.sh/uv/), and Node.js with [pnpm](https://pnpm.io/).

## Installation

1. Copy `.env.example` to `.env` and replace the passwords.

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
| `DB_USER`, `DB_PASS`, `DB_NAME` | Application database and its user | Yes | None |
| `VITE_API_URL` | Public URL of the API, as seen from the browser | No | `http://localhost:8888/api` |

## Environments

The project covers development and deployment environments (step 8 of the [roadmap](../ROADMAP.md)). Their details are `TBD`.

## Troubleshooting

`TBD`.
