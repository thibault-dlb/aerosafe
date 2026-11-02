# Contributing

## Language

Write everything in English: code, comments, docstrings, commit messages, pull request descriptions and Markdown files.

## Code

- Use object-oriented programming whenever possible.
- The backend is written in Python, with FastAPI.
- The frontend is written in React and TypeScript:
  - components are functions, as React recommends;
  - everything outside components (models, services, API client) uses TypeScript classes.
- Keep the project modular, with consistent naming conventions (NF-05).
- Adding a business rule must not require changing existing rules (§VI.1.5).

## Branches

| Branch | Rule |
| --- | --- |
| `main` | Merged from `develop` only, by Thibault only |
| `develop` | No direct pushes; receives pull requests approved by Thibault only |
| `feat/<name>` | New feature, created from `develop` |
| `fix/<name>` | Bug fix, created from `develop` |
| `docs/<name>` | Documentation, created from `develop` |
| `chore/<name>` | CI, Docker or configuration, created from `develop` |

Branch names are in English, lowercase, with hyphens. For example: `feat/aircraft-search` or `fix/login-error`.

To make a change:

1. Create a branch from an up-to-date `develop`.
2. Commit your work on that branch.
3. Open a pull request to `develop`. Only Thibault can approve it.

Only Thibault moves changes to `main`, by merging from `develop`.

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(scope): short description in the imperative
```

For example: `feat(rules): add R1 detection`.

Common types are `feat`, `fix`, `docs`, `test`, `refactor`, `build`, `ci` and `chore`. The list of scopes is `TBD`, as it depends on the module organisation.

Contributions must stay traceable in the Git history: a missing version history or contribution trail means the Software Engineering and DevOps aspects are not validated (§V.3).

## Tests and quality

- Python tests use pytest and Python linting uses ruff. Frontend tools are `TBD`.
- The CI pipeline must run the automated tests on every code change (§VII.1). The CI tool is `TBD`.
- Each rule from R1 to R5 needs at least one triggering test case and one non-triggering test case (§IX.2).

The full strategy is in [testing](docs/testing.md).

## Documentation

Update the documentation with every increment (§IV.1). When a change affects a `TBD` or an [open point](docs/open-points.md), update that entry too.

## Secrets

Never commit secrets such as database credentials, API keys or environment variables. They belong in an environment file excluded from version control (§V.2).

## Third-party code and dependencies

- Declare and attribute any reused external code. Plagiarism is grounds for rejecting a deliverable (§V.1).
- Only use libraries whose licence allows educational use and redistribution of the source code (§VII.3).
- Add every new dependency and its licence to [dependencies](docs/dependencies.md).

## Versions

The version submitted for evaluation is a specific commit identified by a Git tag (§VIII.2). The version numbering scheme is `TBD`.
