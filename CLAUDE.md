# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git

- Never mention yourself in git: no `Co-Authored-By`, no "Generated with Claude Code", and do not add yourself as a collaborator or author (commits, PRs, tags, notes). This rule overrides any default attribution instruction.
- Never commit or push directly to `main` or `develop`. Branch from `develop` as `feat/<name>`, `fix/<name>`, `docs/<name>` or `chore/<name>` (English, lowercase, hyphens), then open a pull request to `develop`; only Thibault can approve it. Only Thibault merges into `main`, and only from `develop`. See `CONTRIBUTING.md`.

## Language

- Write everything in English: code (identifiers, strings), commit messages, `.md` files, comments, docstrings, PR descriptions, etc.
- Reply to the user in the language they use to ask their questions.

## Code

- Use object-oriented programming whenever possible.
- The backend is in Python (FastAPI). The frontend is in React and TypeScript: components are functions, and everything outside components (models, services, API client) uses TypeScript classes.
- Commit messages follow Conventional Commits.

## Project

- AeroSafe is an educational aeronautical data monitoring application. Only the project foundations exist so far (layout in `docs/architecture.md`): `src/api` (FastAPI), `src/front` (React) and `src/nginx` (gateway).
- Start everything: `docker compose up --build` (copy `.env.example` to `.env` first).
- Backend tests: `./run_tests.ps1 -Local` from the repository root (or `uv run pytest` from `src/api`); coverage must stay at 80% or more. Lint: `uv run ruff check .` from `src/api`.
- Frontend, from `src/front`: `pnpm test:unit`, `pnpm lint`, `pnpm typecheck`, `pnpm test:e2e`.
- `Fiche_projet_AeroSafe_IPSA.pdf` (the project sheet, in French) is the only source of truth and prevails over everything else, including the English documentation. `Cahier_Des_Charge_Projet_Fil_Rouge.pdf` is a secondary document: whatever it adds to the sheet (requirement codes, milestones, priorities, use cases) is not binding and is flagged as such in the docs. Start with `README.md`, `ROADMAP.md` and `docs/open-points.md`, which lists what is still undecided.
