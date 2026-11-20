# Roadmap

Source: [project sheet](Fiche_projet_AeroSafe_IPSA.pdf) §9 and §10, the only source of truth. Last updated: 2026-11-20.

Anything flagged `Not in the project sheet` comes from the specifications and is not binding. See [open points](docs/open-points.md).

The work is shared between the five group members in [team work split](docs/team-split.md).

## Current status

- The project sheet defines nine steps and three deliverables. It sets no milestones and no dates, and the team confirmed that no milestones apply.
- The shared foundation is merged into `develop` (pull request #11): the container stack, the test tooling, the database models and migrations, and empty routes and pages for each work package.
- Merged into `develop` since: the aircraft lookup (#14), the collection (#16, #17), the authentication API (#18), the rules engine with the alerts (#19), the frontend choices (#21), more API tests (#22), the brand identity (#23, logo, colour themes and fonts in `docs/brand/`) and a fix for a flaky alerts test (#24).
- The interface is built: every page of the application exists, is styled and is translated (French by default, English switch). The home, log in and sign up pages are public; every other page needs a login, and the logged in pages live in a shell with a side bar and a top bar (with a 404 page). The alert and rule pages, the aircraft and flight pages (with the flight statistics), the accounts page and the account page (with the API of the accounts) and the dashboard (figures, active alerts, chart of alerts per rule, state of the collection, with its API) are done. The shared elements of the pages (notifications, dialog, criticality marks, rule pictograms, units, oriented map markers) are in place. The interface has a single dark theme (the light theme was dropped on 2026-11-15, D-21). The dashboard map is drawn by the application (no tile), moves every aircraft smoothly, follows one aircraft, and a click on an alert centres the map on its aircraft before opening it in the alerts page. The historical replay works end to end (D-20): a shared simulated clock in the API, the rules R3 to R5 on the replayed traffic, a Live / Replay switch in the top bar and a small floating player at the bottom of the application pages; the home page has none. Ground speeds are in km/h by default, and the vertical rate of R3 keeps its sign (D-22). See [team work split](docs/team-split.md#interface).
- Step 2 (design) is validated with the supervising teacher: the UML diagrams, the thresholds of rules R1 to R5, the answers to the ambiguities A-01 to A-04 and every team decision of 2026-11-03 and 2026-11-09.
- The CI pipeline runs on GitHub Actions on every push (step 7): lint, formatting, tests with the 80% coverage threshold, production build, Docker stack, migration round trip, end-to-end tests on three browsers, a dependency review on pull requests and CodeQL (Python, TypeScript and the workflows). Deployment is not started.
- The last pull request merged into `develop` is #39 (2026-11-15). No pull request or issue is open on 2026-11-20, and no Git tag exists yet.
- The OpenSky account of the group and its OAuth2 API client exist (2026-11-20, 4 000 credits a day). A test on 2026-11-20, without a database, ran the real token provider, OpenSky client and normaliser on the Île-de-France area: the token was obtained and 78 state vectors were read and cleaned, none rejected. The collection has not run end to end in the stack yet (storage, flights, scheduler), because Docker is not installed on the machine of the account holder, who has asked the IT service for it. `COLLECTION_ENABLED` stays `false` by default.
- Not started: the continuous deployment, the monitoring and the AI module (bonus, not assigned).
- The repository is public since 2026-11-09, with the agreement of the supervising teacher.

## Steps

| # | Step | Tasks (project sheet) | Status |
| --- | --- | --- | --- |
| 1 | Analysis and specification | Analyse requirements, identify actors and use cases, define features and business rules | Done; the ambiguities of the sheet are settled and confirmed by the supervising teacher |
| 2 | Design | UML modelling, software architecture, database design, module organisation, technology choices | Done: technology choices, repository layout, UML diagrams, data model and rule thresholds validated with the supervising teacher; migrations written; interface design decided (D-19) |
| 3 | Development | Web application, interface, authentication and role management, alert system | Done for the required features: collection, flights, aircraft lookup, authentication and roles, accounts, rules R1 to R5 and alerts, dashboard, replay, and every interface page (see [team work split](docs/team-split.md#interface)). Left: the collection has not run end to end in the stack with the OpenSky account (the account works, see above), and the AI module (bonus) is not started |
| 4 | Testing and quality | Unit tests, integration tests, component checks, fixes and code improvements | In progress: pytest (unit, API and integration), Vitest and Playwright suites exist for every work package and run in CI with an 80% coverage threshold. Left: the test data, the test cases of R1 to R5 and the functional acceptance record in [testing](docs/testing.md) are still `TBD` |
| 5 | Documentation and evolution | Technical and functional documentation, maintenance, evolution, new features including AI | In progress: the requirements, business rules, data model, API, user guide and historical data are written and kept with the code. Left: the installation environments and troubleshooting, the dependency versions, the detailed architecture and the testing record (all `TBD`); the AI evolution is not started |
| 6 | Code and version management | Git, branch management, version management | In place: Git, branching strategy, pull requests |
| 7 | Automation and integration | Test automation, continuous integration, CI/CD pipeline | In progress: CI on GitHub Actions on every push (lint, formatting, tests, build, Docker stack, migration round trip, end-to-end tests on three browsers, CodeQL); continuous deployment not started |
| 8 | Containers and environments | Docker, development and deployment environments | In place: Docker Compose starts PostGIS, the API, the front and the Nginx gateway from one command; the deployment environment is `TBD` |
| 9 | Deployment and monitoring | Prepare deployment, deploy, check and monitor operation | Not started |

## Milestones

The project sheet defines no milestone. The specifications (§IV.1) list J1 to J4 with every due date "to be defined"; the team confirmed on 2026-11-12 that no milestone applies, so only the nine steps and the three deliverables below structure the work.

## Next actions

From the project sheet:

- [x] Validate the UML diagrams drafted in `docs/uml/` (step 2, deliverable 1) and confirm the [team decisions](docs/open-points.md) with the supervising teacher (2026-11-12)
- [x] Formalise the data model and the database design (step 2): relational schema, integrity constraints, indexes
- [x] Validate the proposed thresholds and calculations of rules R1 to R5 in [business rules](docs/business-rules.md) (§6: "second stage"; see D-04) (2026-11-12)
- [x] Choose the mapping library and the CI/CD tool using a written justification (Leaflet without its React wrapper, GitHub Actions)
- [x] Set up the CI pipeline with GitHub Actions (step 7)
- [x] Make the `backend`, `frontend`, `stack` and `dependency-review` CI jobs required to merge into `develop` and `main` (2026-11-09)
- [x] Confirm with the supervising teacher the team's answers to the ambiguities of the sheet (A-01 to A-04 in [open points](docs/open-points.md)) (2026-11-12)
- [x] Decide the interface design (D-19): logo, colour themes and fonts in [brand guidelines](docs/brand/brand-guidelines.md), and the other choices of [technology choices](docs/technology-choices.md#interface-design)
- [x] Replay the historical traffic (D-20): the replay clock, the rules on replayed traffic, the source of the data in the API, the Live / Replay switch in the top bar and the floating replay player (Thibault), and every page translated in French and English
- [x] Finish the interface: the styles and the home page (Thibault), log in, sign up and accounts (Louis-Amaury), the dashboard (Jules), then the design applied to every page (see [team work split](docs/team-split.md#interface))
- [x] Read the OpenSky terms of use (see [OpenSky Network](docs/opensky.md))
- [x] Register one OpenSky account for the group and create its OAuth2 API client (quotas are documented in [architecture](docs/architecture.md)); the token and the reading of the Île-de-France area were checked on 2026-11-20
- [ ] Run the live collection end to end in the Docker stack with that account: storage of the observations, flights, scheduler and dashboard (needs Docker on the machine of the account holder)
- [ ] Confirm with the supervising teacher the decisions of 2026-11-14 and 2026-11-15 (the dashboard open to a User, the estimated position of an aircraft, the accounts created by a Supervisor, D-22) and V-01 (automated collection and operational use of OpenSky), see [open points](docs/open-points.md)
- [ ] Fill in the test data, the test cases of R1 to R5 and the functional acceptance record in [testing](docs/testing.md)
- [ ] Continuous deployment and monitoring (steps 7 and 9), and the deployment environment (step 8)
- [ ] Decide the version numbering scheme (D-13) and tag the version submitted for evaluation
- [ ] Decide whether to start the AI module (bonus) and choose its library (D-14)
- [ ] Assemble deliverables 1 and 3 (see below)

Repository housekeeping:

- [x] Lock `develop` on GitHub so that changes only arrive through pull requests approved by Thibault (`develop` and `main` are protected; `CODEOWNERS` names Thibault)

Not in the project sheet:

- [x] Whether milestone dates exist, and whether J1 to J4 apply: no milestone applies (2026-11-12)
- [x] Give the supervising teacher access to the repository (specifications §VIII.2): it is public since 2026-11-09

## Deliverables

| Deliverable | Content (project sheet §10) | Format |
| --- | --- | --- |
| 1. Specifications and design | Context and objectives, functional and non-functional requirements, user profiles, features, business rules, UML diagrams, application architecture, data model, technology choices | Written document |
| 2. Application and demonstration | Working AeroSafe application showing its main modules and how they interact | Demonstration, 10 minutes |
| 3. Presentation and methodology | Project, working methods, group organisation, design, technology choices, versions and evolution, features developed, Software Engineering and DevOps aspects | Presentation, 20 minutes per group |

## Delivery details (not in the project sheet)

The specifications add the following. Treat it as unconfirmed until the supervising teacher says it applies.

Deliverable 2 also includes:

- the complete Git repository, with contribution history and branching strategy
- the container files used to launch the application
- the CI pipeline configuration
- the automated test suites and their execution results
- the technical documentation (installation, configuration, architecture, API) and functional documentation (user guide by profile)

| Item | Format |
| --- | --- |
| Written documents | PDF, submitted through the channel set by the supervising teacher, named `AeroSafe_<Deliverable>_<Group>_<Version>` |
| Source code | Git repository accessible to the supervising teacher, with a README describing installation and launch |
| Application | Runs through containers, from a single documented command, on a machine with no prior setup |
| Technical documentation | In the repository as Markdown, and/or generated automatically for the API |
| Presentation | PDF or presentation file, submitted before the defence |
| Demonstration | In person, on a prepared scenario covering the essential features, within 10 minutes |

Each deliverable has a version number and a date. The version submitted for evaluation is a specific commit identified by a Git tag. All deliverables must be submitted before the defence date set by the supervising teacher.
