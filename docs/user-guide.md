# User guide

`TBD`: the application does not exist yet. This page lists what each profile will be able to do, according to the project sheet and the specifications. Step-by-step instructions will be added during development.

> **Disclaimer:** AeroSafe is an educational project. It is not a certified air traffic surveillance or management system and must not be used operationally. This limitation is also shown in the application (§VII.3).

Access to the application requires authentication. Each account has one role, User or Supervisor, which determines the features available.

Coverage of air traffic depends on the OpenSky Network receiver network and is not uniform across regions.

## User

| Task | Use case | Instructions |
| --- | --- | --- |
| Search for an aircraft by ICAO24, registration, airline or area | UC-01 | See [Searching for an aircraft](#searching-for-an-aircraft) |
| View an aircraft record and its observation history | UC-01 | See [Aircraft record](#aircraft-record) |
| View a flight trajectory on a map, with altitude and speed profiles | UC-02 | See [Flight trajectory](#flight-trajectory) |
| View flight statistics | UC-02 | See [Flight trajectory](#flight-trajectory) |

### Searching for an aircraft

1. Open **Aircraft** in the navigation bar.
2. Fill one or more criteria: the start of the ICAO24 address (for example `3c64`), part of the registration (`F-GK`), part of the airline name or code (`Air France`, `AFR`). Case does not matter.
3. To search an area, fill its four bounds in degrees: south and north latitudes, west and east longitudes. The area applies to the latest known position of each aircraft.
4. Select **Search**. The matching aircraft are listed with their model, airline and last contact, and those with a known position are shown on the map.
5. Select an aircraft to open its record.

If nothing matches, the page says so: broaden the criteria, for example by shortening the address or removing a criterion.

### Aircraft record

The record shows the address, registration, model, airline and last contact of the aircraft, its latest position on the map, its flights and its latest 50 observations, newest first: time, altitude (m), speed (m/s), heading (°), position and whether the aircraft was on the ground. A dash means OpenSky did not send the value. Select a flight to open its trajectory.

### Flight trajectory

The flight page shows the trajectory on the map, with the latest position marked, then the statistics (duration, distance, mean and maximum altitude and speed, number of observations) and the altitude and speed profiles.

When observations are missing for more than 5 minutes, the trajectory is partial: the page lists the missing segments and the map does not join the points on either side of a gap. The distance leaves those segments out.

The map shows OpenStreetMap tiles. The aircraft data comes from the OpenSky Network, credited on the map.

## Supervisor

The Supervisor can also search for and view aircraft (UC-01). Only the dashboard, the alerts and the rules appear in the project sheet; processing alerts, adjusting thresholds and managing accounts come from the specifications (A-02).

| Task | Use case | Instructions |
| --- | --- | --- |
| Open the supervision dashboard | UC-04 | `TBD` |
| Filter and sort alerts by rule, period or aircraft | UC-04 | `TBD` |
| View the details of an alert and mark it as processed | UC-04 | `TBD` |
| View and adjust the thresholds of a rule | UC-05 | `TBD` |
| Create, modify or deactivate accounts and assign roles | UC-06 | `TBD` |
| Compare rule alerts with AI anomaly scores (bonus) | UC-07 | `TBD` |

## Dashboard content

The project sheet does not describe the dashboard content (A-04). The specifications say it shows an overview of tracked aircraft and alerts (§VI.1.7):

- number of alerts by rule and by period;
- the aircraft most often concerned;
- recent alerts;
- status indicators for the data collection system.
