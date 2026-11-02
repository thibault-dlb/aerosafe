# Roadmap

Source: specifications §IV.1, §VII.2 and §VIII. Last updated: 2026-11-02.

## Current status

- The specifications are at version 1.0 (14 September 2026).
- The UML diagrams called for by the specifications have not been produced yet in this repository.
- No application code has been written.
- Milestone J1 status: **to be confirmed**.

## Approach

The project is iterative. Each step produces an increment versioned in Git and an update of the documentation.

## Steps

| # | Step | Main tasks |
| --- | --- | --- |
| 1 | Analysis and specification | Analyse requirements, identify actors and use cases, define features and business rules |
| 2 | Design | UML modelling, software architecture and database design, module organisation, technology choices |
| 3 | Development | Web application, interface, authentication and role management, alert system |
| 4 | Testing and quality | Unit tests, integration tests, component checks, fixes and code improvements |
| 5 | Documentation and evolution | Technical and functional documentation, maintenance, evolution, new features including AI |
| 6 | Code and version management | Git, branch management, version management |
| 7 | Automation and integration | Test automation, continuous integration, CI/CD pipeline |
| 8 | Containers and environments | Docker, development and deployment environments |
| 9 | Deployment and monitoring | Prepare deployment, deploy, check and monitor operation |

Steps 6 to 8 are cross-cutting: they are set up from the start of development and maintained throughout the project.

## Milestones

| Milestone | Expected content | Due date | Status |
| --- | --- | --- | --- |
| J1 | Specifications and design validated (UML, architecture, data model) | `TBD`, to be set with the supervising teacher | To be confirmed |
| J2 | Working intermediate version: API, database, authentication, flight lookup | `TBD` | Not started |
| J3 | Complete version: rules engine, alerts, dashboard, tests and CI/CD | `TBD` | Not started |
| J4 | Demonstration and final defence | `TBD` | Not started |

Any delay on a milestone must be reported to the supervising teacher as soon as it is identified.

## Requirements by milestone

The specifications describe milestones in words and do not map them to requirement codes. This mapping is inferred from that wording and is indicative only.

| Milestone | Requirements | Basis |
| --- | --- | --- |
| J2 | BF-01, BF-02 | "authentication" |
| J2 | BF-03 | "database" |
| J2 | BF-04, BF-05, BF-06 | "flight lookup" |
| J3 | BF-09, BF-10, BF-11, BF-12 | "rules engine, alerts, dashboard" |
| Not assigned | BF-07, BF-08, BF-13, BF-14 | Not named in any milestone; see [open points](docs/open-points.md) |
| After all priority E requirements | BF-15 | The bonus AI module only starts once priority E requirements are met (§VII.2) |

## Next actions

Taken from the specifications and from the current state of the repository:

- [ ] Confirm the status of J1
- [ ] Set the milestone dates with the supervising teacher
- [ ] Give the supervising teacher access to the private repository (§VIII.2; the repository owner must do this)
- [ ] Produce the UML diagrams: use cases, classes, sequence for alert detection and generation, components
- [ ] Formalise the data model: relational schema, integrity constraints, indexes
- [ ] Define the thresholds of rules R1 to R5
- [ ] Choose the mapping library and the CI/CD tool using the selection grid
- [ ] Lock `develop` on GitHub so that changes only arrive through pull requests approved by Thibault (the repository owner must do this)
- [ ] Check the OpenSky Network terms of use and access conditions
- [ ] Resolve the [open points](docs/open-points.md) with the supervising teacher

## Deliverables

| Deliverable | Content | Format |
| --- | --- | --- |
| 1. Specifications and design | Context and objectives, functional and non-functional requirements, user profiles, features, business rules, UML diagrams, architecture, data model, technology choices | Written document |
| 2. Application and demonstration | Working AeroSafe application showing its main modules and how they interact | Demonstration, 10 minutes |
| 3. Presentation and methodology | Project, working methods, group organisation, design, technology choices, versions and evolution, features developed, Software Engineering and DevOps aspects | Presentation, 20 minutes per group |

Deliverable 2 also includes:

- the complete Git repository, with contribution history and branching strategy
- the container files used to launch the application
- the CI pipeline configuration
- the automated test suites and their execution results
- the technical documentation (installation, configuration, architecture, API) and functional documentation (user guide by profile)

### Delivery format

| Item | Format |
| --- | --- |
| Written documents | PDF, submitted through the channel set by the supervising teacher, named `AeroSafe_<Deliverable>_<Group>_<Version>` |
| Source code | Git repository accessible to the supervising teacher, with a README describing installation and launch |
| Application | Runs through containers, from a single documented command, on a machine with no prior setup |
| Technical documentation | In the repository as Markdown, and/or generated automatically for the API |
| Presentation | PDF or presentation file, submitted before the defence |
| Demonstration | In person, on a prepared scenario covering the essential features, within 10 minutes |

Each deliverable has a version number and a date. The version submitted for evaluation is a specific commit identified by a Git tag.

All deliverables must be submitted before the defence date set by the supervising teacher.
