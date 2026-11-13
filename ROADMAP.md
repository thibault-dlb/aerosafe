# Roadmap

Source: [project sheet](Fiche_projet_AeroSafe_IPSA.pdf) §9 and §10, the only source of truth. Last updated: 2026-11-13.

Anything flagged `Not in the project sheet` comes from the specifications and is not binding. See [open points](docs/open-points.md).

The work is shared between the five group members in [team work split](docs/team-split.md).

## Current status

- The project sheet defines nine steps and three deliverables. It sets no milestones and no dates, and the team confirmed that no milestones apply.
- The shared foundation is merged into `develop` (pull request #11): the container stack, the test tooling, the database models and migrations, and empty routes and pages for each work package. 
- Merged into `develop` since: the aircraft lookup (#14), the collection (#16, #17), the authentication API (#18), the rules engine with the alerts (#19), the frontend choices (#21), more API tests (#22), the brand identity (#23, logo, colour themes and fonts in `docs/brand/`) and a fix for a flaky alerts test (#24).
- The interface is partly built. The aircraft, flight, alert and rule pages work but have no styling. The home, log in, sign up, accounts and dashboard pages are still empty, and the API of the accounts and of the dashboard is not written. The front has no stylesheet yet, although the interface design is now decided (D-19). See [team work split](docs/team-split.md#interface).
- Step 2 (design) is validated with the supervising teacher: the UML diagrams, the thresholds of rules R1 to R5, the answers to the ambiguities A-01 to A-04 and every team decision of 2026-11-03 and 2026-11-09.
- The CI pipeline runs on GitHub Actions on every push (step 7): lint, formatting, tests, production build, Docker stack, migration round trip, end-to-end tests on three browsers and CodeQL. Deployment is not started.
- The repository is public since 2026-11-09, with the agreement of the supervising teacher.

## Steps

| # | Step | Tasks (project sheet) | Status |
| --- | --- | --- | --- |
| 1 | Analysis and specification | Analyse requirements, identify actors and use cases, define features and business rules | Done; the ambiguities of the sheet are settled and confirmed by the supervising teacher |
| 2 | Design | UML modelling, software architecture, database design, module organisation, technology choices | Done: technology choices, repository layout, UML diagrams, data model and rule thresholds validated with the supervising teacher; migrations written; interface design decided (D-19) |
| 3 | Development | Web application, interface, authentication and role management, alert system | Foundation, aircraft lookup, collection, authentication API, rules and alerts merged; accounts, dashboard, log in and home screens and the application of the design still to do, see [team work split](docs/team-split.md#interface) |
| 4 | Testing and quality | Unit tests, integration tests, component checks, fixes and code improvements | Tooling in place (pytest, Vitest, Playwright); each work package brings its own tests |
| 5 | Documentation and evolution | Technical and functional documentation, maintenance, evolution, new features including AI | In progress: documentation skeleton |
| 6 | Code and version management | Git, branch management, version management | In place: Git, branching strategy, pull requests |
| 7 | Automation and integration | Test automation, continuous integration, CI/CD pipeline | In progress: CI on GitHub Actions on every push (lint, formatting, tests, build, Docker stack, migration round trip, end-to-end tests on three browsers, CodeQL); continuous deployment not started |
| 8 | Containers and environments | Docker, development and deployment environments | In place: Docker Compose; environments `TBD` |
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
- [ ] Replay the historical traffic (D-20): the replay clock, the rules on replayed traffic, the source of the data in the API and the Live / Replay switch in the interface (Thibault). Left to do: the pages of the other work packages still show their own texts in English only
- [ ] Finish the interface: the styles and the home page (Thibault), log in, sign up and accounts (Louis-Amaury), the dashboard (Jules), then the design applied to every page (see [team work split](docs/team-split.md#interface))
- [x] Read the OpenSky terms of use (see [OpenSky Network](docs/opensky.md))
- [ ] Register one OpenSky account for the group and create its OAuth2 API client (quotas are documented in [architecture](docs/architecture.md))

Repository housekeeping:

- [x] Lock `develop` on GitHub so that changes only arrive through pull requests approved by Thibault

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
