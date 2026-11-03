# Requirements

English translation of specifications §I to §III and §VI.2. The [French PDF](../Cahier_Des_Charge_Projet_Fil_Rouge.pdf) prevails. Contradictions found in the source are listed in [open points](open-points.md).

## Objectives

AeroSafe is a complete web application used to:

- search for and view aircraft information;
- analyse observations and flight parameters (position, altitude, speed, heading);
- reconstruct a trajectory and display it on a map;
- detect unusual behaviour with a business rules engine;
- generate and store alerts for these detections;
- provide a supervision dashboard;
- analyse the aeronautical and geospatial data collected;
- optionally, evolve detection towards an approach based on artificial intelligence.

Educational objectives go with these: mastering the software lifecycle, collaborative work with Git, code quality and testability, automated integration and reproducible deployment.

## Scope

### In scope

- Acquiring OpenSky Network data and storing it in PostgreSQL
- A FastAPI backend exposing business services and data
- A web interface for lookup, analysis and supervision
- User authentication and role management (User / Supervisor)
- Aircraft search, flight lookup, trajectory reconstruction and map display
- Calculating and displaying flight statistics
- The business rules engine (R1 to R5) and the related alerts
- The supervision dashboard and alert management
- Technical and functional documentation
- Unit and integration tests, CI/CD pipeline, Docker containers and deployment

### Bonus

Not required for the base version: the AI anomaly detection module, and its comparison between the deterministic approach (R1 to R5) and the machine learning approach.

### Out of scope

- Any real operational use in air traffic control or security: AeroSafe is an educational project and in no way a certified tool
- Exhaustive coverage of global air traffic, which depends on OpenSky Network receiver coverage
- A native mobile application
- Production hosting on paid external infrastructure, outside the educational environment
- Integration with third-party systems (airlines, civil aviation authorities)

## Functional requirements

Priorities: **E** essential, required for acceptance; **I** important; **O** optional or bonus.

| Ref. | Requirement | Description | Priority |
| --- | --- | --- | --- |
| BF-01 | Authentication | Secure account creation, login and logout; access to features depends on authentication | E |
| BF-02 | Role management | Assign a role (User or Supervisor) and restrict features according to that role | E |
| BF-03 | Data acquisition | Retrieve OpenSky Network data and feed the PostgreSQL database (observations, aircraft) | E |
| BF-04 | Aircraft search | Search by identifier (ICAO24), registration, airline or geographic area | E |
| BF-05 | Aircraft record | View general information about an aircraft and its observation history | E |
| BF-06 | Flight parameters | Display position, altitude, speed, heading and how they change over time | E |
| BF-07 | Trajectory | Reconstruct a flight from observations and display its trajectory on a map | E |
| BF-08 | Flight statistics | Calculate and display indicators: duration, distance travelled, average and maximum altitude, average speed | I |
| BF-09 | Rules engine | Periodically evaluate rules R1 to R5 on the data collected | E |
| BF-10 | Alert generation | Create and store an alert when a rule is triggered | E |
| BF-11 | Dashboard | Supervision dashboard with an overview of tracked aircraft and alerts | E |
| BF-12 | Alert management | View, filter and sort alerts, and view their details (aircraft, rule, date and time, observed value, threshold, message) | E |
| BF-13 | Rule settings | Supervise and eventually configure the triggering thresholds of business rules | I |
| BF-14 | Account management | Supervisor administration of accounts and roles | I |
| BF-15 | AI module | Anomaly detection through machine learning, producing an anomaly score compared with the deterministic approach | O |

## Non-functional requirements

| Ref. | Criterion | Requirement |
| --- | --- | --- |
| NF-01 | Performance | Searches and trajectory display stay smooth even with a large volume of historical data. Indicative target: API response under 2 seconds on a standard search |
| NF-02 | Security | Mandatory authentication, role management (User / Supervisor), passwords stored as hashes, protection of stored data and API endpoints |
| NF-03 | Usability | Clear, intuitive interface suited to quickly reviewing flights and alerts; readable map and visual prioritisation of alerts |
| NF-04 | Availability | The application stays accessible and stable during demonstrations, including when the external data source is temporarily unavailable |
| NF-05 | Maintainability | Structured, documented code versioned in Git; modular organisation; consistent naming and commit conventions |
| NF-06 | Extensibility | The architecture allows new business rules or an AI module to be added later without reworking what exists |
| NF-07 | Portability | Containerised deployment (Docker) with reproducible execution across development and deployment environments |
| NF-08 | Traceability | Logging of technical events and rule triggers, so the generation of an alert can be replayed and explained |

## User profiles

| Profile | Description and expectations |
| --- | --- |
| User | Looks up and analyses aeronautical data: searches aircraft, views flights, trajectories and statistics. Expects quick access to information and a clear reading of flight parameters |
| Supervisor | Supervises aircraft, business rules and alerts through the dashboard. Can configure rules, view and process alerts, and manage accounts and roles. Expects a synthetic view and the ability to react quickly |

The teaching staff (supervising teacher) are a third stakeholder with no access to the application. They commission the project and validate the deliverables.

## Use cases

### UC-01: Search for and view an aircraft

- **Primary actor:** User (also available to the Supervisor)
- **Preconditions:** the user is authenticated; the database contains observations
- **Main flow:**
  1. The user enters a search criterion (ICAO24, registration, airline, area).
  2. The system queries the database and returns the matching aircraft.
  3. The user selects an aircraft.
  4. The system displays the aircraft record and its observation history.
- **Alternative flow:** 2a. No result: the system displays an explicit message and suggests broadening the criteria.
- **Postcondition:** the aircraft record is displayed.

### UC-02: View a flight trajectory

- **Primary actor:** User
- **Preconditions:** an aircraft is selected and has enough observations
- **Main flow:**
  1. The user selects a flight or an observation period.
  2. The system reconstructs the trajectory from the observations.
  3. The system displays the trajectory on a map, with altitude and speed profiles.
  4. The system presents the related flight statistics.
- **Alternative flow:** 2a. Insufficient or discontinuous observations: the system displays the partial trajectory and flags the missing segments.
- **Postcondition:** the trajectory and statistics are displayed.

### UC-03: Detect an unusual situation and generate an alert

- **Primary actor:** System (business rules engine)
- **Preconditions:** rules R1 to R5 are active and configured; data is available
- **Main flow:**
  1. The engine periodically evaluates the rules on the data collected.
  2. A rule detects that a threshold has been exceeded.
  3. The system generates an alert containing the aircraft, the rule, the date and time, the observed value, the threshold and an explanatory message.
  4. The alert is stored in the database and shown on the dashboard.
- **Alternative flow:** 2a. No threshold exceeded: no alert is generated, and the evaluation is logged.
- **Postcondition:** the alert is persisted and available to the Supervisor.

### UC-04: Supervise and process alerts

- **Primary actor:** Supervisor
- **Preconditions:** the Supervisor is authenticated; alerts exist in the database
- **Main flow:**
  1. The Supervisor opens the supervision dashboard.
  2. The system displays the overview of tracked aircraft and alerts.
  3. The Supervisor filters and sorts alerts by rule, period or aircraft.
  4. The Supervisor views the details of an alert and, if applicable, marks it as processed.
- **Alternative flow:** 4a. The alert is judged irrelevant: the Supervisor can adjust the threshold of the rule concerned (UC-05).
- **Postcondition:** the state of the alert is updated.

### Additional use cases

- **UC-05: Configure a business rule.** The Supervisor views and adjusts the triggering thresholds of a rule. The change applies at the next evaluation.
- **UC-06: Authenticate and manage accounts.** The user logs in. The Supervisor creates, modifies or deactivates accounts and assigns roles.
- **UC-07: Compare deterministic and AI detection (bonus).** For a given period, the Supervisor views the alerts from rules R1 to R5 and the anomaly scores produced by the model.
