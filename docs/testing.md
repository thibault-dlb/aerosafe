# Testing

Source: project sheet step 4 (unit tests, integration tests, component checks, fixes) and step 7 (test automation, continuous integration); specifications §IX.1 and §IX.2 for the rest.

The acceptance criteria CA-01 to CA-10, the functional acceptance record and the presence of the supervising teacher at acceptance come from the specifications only and are not in the project sheet.

## Tools

| Scope | Tests | Linting |
| --- | --- | --- |
| Python | pytest | ruff |
| Frontend unit | Vitest, Testing Library | ESLint |
| Frontend end to end | Playwright | ESLint |

Both unit test suites fail below 80% coverage. The CI tool is `TBD`.

| Command | Where | What it does |
| --- | --- | --- |
| `./run_tests.ps1` or `./run_tests.sh` | Repository root | Python test runner with a report per suite (4 workers by default). Options: `-Local` / `--local`, `-Suite unit\|api` / `--suite unit\|api`, `-Verbose` / `--verbose`. Uses the API container when it runs, otherwise uv |
| `uv run pytest` | `src/api` | Python tests with coverage |
| `uv run ruff check .` | `src/api` | Python linting |
| `pnpm test:unit` | `src/front` | Frontend unit tests with coverage |
| `pnpm lint` | `src/front` | Frontend linting |
| `pnpm typecheck` | `src/front` | TypeScript type check |
| `pnpm test:e2e` | `src/front` | End-to-end tests; the application must be running |

## Test levels

| Level | Scope |
| --- | --- |
| Unit | Priority on the business rules engine, flight statistics and trajectory reconstruction |
| Integration | API endpoints, database interactions and role checks |
| Non-regression | The whole suite runs automatically on every code change through the CI/CD pipeline |
| Functional acceptance | Use cases UC-01 to UC-06 run in the presence of the supervising teacher |
| Deployment check | Install and launch on a clean environment using only the documentation provided |

## Test data

A reproducible set of observations, independent of the external source's availability, is used to replay the detection scenarios. Its content is `TBD`.

## Business rule coverage

Each rule needs at least one triggering case and one non-triggering case.

| Rule | Triggering case | Non-triggering case |
| --- | --- | --- |
| R1 | `TBD` | `TBD` |
| R2 | `TBD` | `TBD` |
| R3 | `TBD` | `TBD` |
| R4 | `TBD` | `TBD` |
| R5 | `TBD` | `TBD` |

## Functional acceptance record

Each case is recorded with its expected and actual result. See [requirements](requirements.md) for the use cases.

| Use case | Expected result | Actual result |
| --- | --- | --- |
| UC-01: Search for and view an aircraft | The aircraft record is displayed | `TBD` |
| UC-02: View a flight trajectory | The trajectory and statistics are displayed | `TBD` |
| UC-03: Detect an unusual situation and generate an alert | The alert is persisted and available to the Supervisor | `TBD` |
| UC-04: Supervise and process alerts | The state of the alert is updated | `TBD` |
| UC-05: Configure a business rule | The change applies at the next evaluation | `TBD` |
| UC-06: Authenticate and manage accounts | The user logs in; the Supervisor creates, modifies or deactivates accounts and assigns roles | `TBD` |

## Acceptance criteria

The project is accepted when all of these are met.

| Ref. | Criterion | Status |
| --- | --- | --- |
| CA-01 | All priority E functional requirements (BF-01 to BF-12) are implemented and can be demonstrated | Not met |
| CA-02 | Authentication and role-based feature restriction are effective and verified | Not met |
| CA-03 | OpenSky Network data is actually collected and persisted in PostgreSQL | Not met |
| CA-04 | A trajectory is reconstructed and displayed correctly on a map from stored observations | Not met |
| CA-05 | The five rules R1 to R5 are implemented and generate alerts in the format defined in §VI.1.6 | Not met |
| CA-06 | The dashboard shows tracked aircraft and alerts, with filtering and detail views | Not met |
| CA-07 | The application starts fully through the documented container procedure, on a clean environment | Not met |
| CA-08 | The CI pipeline runs without error and triggers the automated tests | Not met |
| CA-09 | The technical and functional documentation is complete and up to date for the delivered version | Not met |
| CA-10 | The demonstration runs with no blocking issue within the allotted time | Not met |
