# Roadmap

Source: [project sheet](Fiche_projet_AeroSafe_IPSA.pdf) §9 and §10, the only source of truth. Last updated: 2026-11-03.

Anything flagged `Not in the project sheet` comes from the specifications and is not binding. See [open points](docs/open-points.md).

## Current status

- The project sheet defines nine steps and three deliverables. It sets no milestones and no dates.
- Only the project foundations exist: an API with a health check, an empty web interface, the container stack and the test tooling. No business feature has been developed.
- Step 2 (design) is incomplete: the UML diagrams, the database design and the module organisation have not been produced.
- There is no CI pipeline yet (step 7).

## Steps

| # | Step | Tasks (project sheet) | Status |
| --- | --- | --- | --- |
| 1 | Analysis and specification | Analyse requirements, identify actors and use cases, define features and business rules | Largely done; several items come from the specifications, not from the sheet |
| 2 | Design | UML modelling, software architecture, database design, module organisation, technology choices | In progress: technology choices (mapping library, CI tool, authentication) and repository layout set; UML diagrams drafted in `docs/uml/` and to validate; relational schema not produced |
| 3 | Development | Web application, interface, authentication and role management, alert system | Foundations only |
| 4 | Testing and quality | Unit tests, integration tests, component checks, fixes and code improvements | Tooling in place (pytest, Vitest, Playwright); no business tests yet |
| 5 | Documentation and evolution | Technical and functional documentation, maintenance, evolution, new features including AI | In progress: documentation skeleton |
| 6 | Code and version management | Git, branch management, version management | In place: Git, branching strategy, pull requests |
| 7 | Automation and integration | Test automation, continuous integration, CI/CD pipeline | Not started |
| 8 | Containers and environments | Docker, development and deployment environments | In place: Docker Compose; environments `TBD` |
| 9 | Deployment and monitoring | Prepare deployment, deploy, check and monitor operation | Not started |

## Milestones

The project sheet defines no milestone. The table below comes from the specifications (§IV.1), where every due date is "to be defined". Nothing here is binding, and the status of J1 cannot be checked against the sheet.

| Milestone | Expected content (specifications) | Due date |
| --- | --- | --- |
| J1 | Specifications and design validated (UML, architecture, data model) | `TBD` |
| J2 | Working intermediate version: API, database, authentication, flight lookup | `TBD` |
| J3 | Complete version: rules engine, alerts, dashboard, tests and CI/CD | `TBD` |
| J4 | Demonstration and final defence | `TBD` |

## Next actions

From the project sheet:

- [ ] Validate the UML diagrams drafted in `docs/uml/` (step 2, deliverable 1) and confirm the [team decisions](docs/open-points.md) with the supervising teacher
- [ ] Formalise the data model and the database design (step 2): relational schema, integrity constraints, indexes
- [ ] Validate the proposed thresholds and calculations of rules R1 to R5 in [business rules](docs/business-rules.md) (§6: "second stage"; see D-04)
- [ ] Set up the CI pipeline with GitHub Actions (step 7)
- [ ] Confirm with the supervising teacher the team's answers to the ambiguities of the sheet (A-01 to A-04 in [open points](docs/open-points.md))
- [ ] Read the OpenSky terms of use and register an account for the OAuth2 credentials (quotas are documented in [architecture](docs/architecture.md))

Repository housekeeping:

- [ ] Lock `develop` on GitHub so that changes only arrive through pull requests approved by Thibault (the repository owner must do this)

Not in the project sheet, to confirm with the supervising teacher:

- [ ] Whether milestone dates exist, and whether J1 to J4 apply
- [ ] Give the supervising teacher access to the private repository (specifications §VIII.2; the repository owner must do this)
- [ ] Check the OpenSky Network terms of use and access conditions

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
