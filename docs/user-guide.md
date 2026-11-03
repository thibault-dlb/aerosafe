# User guide

`TBD`: the application does not exist yet. This page lists what each profile will be able to do, according to the specifications. Step-by-step instructions will be added during development.

> **Disclaimer:** AeroSafe is an educational project. It is not a certified air traffic surveillance or management system and must not be used operationally. This limitation is also shown in the application (§VII.3).

Access to the application requires authentication. Each account has one role, User or Supervisor, which determines the features available.

Coverage of air traffic depends on the OpenSky Network receiver network and is not uniform across regions.

## User

| Task | Use case | Instructions |
| --- | --- | --- |
| Search for an aircraft by ICAO24, registration, airline or area | UC-01 | `TBD` |
| View an aircraft record and its observation history | UC-01 | `TBD` |
| View a flight trajectory on a map, with altitude and speed profiles | UC-02 | `TBD` |
| View flight statistics | UC-02 | `TBD` |

## Supervisor

The Supervisor can also search for and view aircraft (UC-01).

| Task | Use case | Instructions |
| --- | --- | --- |
| Open the supervision dashboard | UC-04 | `TBD` |
| Filter and sort alerts by rule, period or aircraft | UC-04 | `TBD` |
| View the details of an alert and mark it as processed | UC-04 | `TBD` |
| View and adjust the thresholds of a rule | UC-05 | `TBD` |
| Create, modify or deactivate accounts and assign roles | UC-06 | `TBD` |
| Compare rule alerts with AI anomaly scores (bonus) | UC-07 | `TBD` |

## Dashboard content

The dashboard shows an overview of tracked aircraft and alerts (§VI.1.7):

- number of alerts by rule and by period;
- the aircraft most often concerned;
- recent alerts;
- status indicators for the data collection system.
