# User guide

The application is partly built. Searching for an aircraft, the aircraft record, the flight trajectory, the alerts and the rules work and are described below. The accounts and the dashboard (apart from its live overview, the figures and the map) are not built yet, and their instructions stay `TBD` (see [team work split](team-split.md#interface)). This page lists what each profile will be able to do, according to the project sheet and the specifications. Step-by-step instructions are added as each part is developed.

> **Disclaimer:** AeroSafe is an educational project. It is not a certified air traffic surveillance or management system and must not be used operationally. This limitation is also shown in the application (§VII.3).

Access to the application requires authentication. Each account has one role, User or Supervisor, which determines the features available.

### Signing up and logging in

1. Open the application. Only the home page is public: any other address takes you to the log in screen, and brings you back to the page you asked for once you are logged in.
2. To create an account, choose **Inscription** (or **Sign up**), give an e-mail address and a password of 12 characters at least, and confirm. The gauge under the password shows how far you are from the 12 characters. You are logged in at once and the account has the User role.
3. To log in, choose **Connexion** (or **Log in**), give your e-mail address and your password, and confirm. After five failed attempts in a row the account is locked for 15 minutes.
4. The session stays open when you reload the page. To close it, use **Se déconnecter** (or **Log out**) in the bar.

The Supervisor pages (alerts, rules, accounts) show an "access restricted" page to a User.

Coverage of air traffic depends on the OpenSky Network receiver network and is not uniform across regions.

## User

| Task | Use case | Instructions |
| --- | --- | --- |
| Search for an aircraft by ICAO24, registration, airline or area | UC-01 | See [Searching for an aircraft](#searching-for-an-aircraft) |
| View an aircraft record and its observation history | UC-01 | See [Aircraft record](#aircraft-record) |
| View a flight trajectory on a map, with altitude and speed profiles | UC-02 | See [Flight trajectory](#flight-trajectory) |
| View flight statistics | UC-02 | See [Flight trajectory](#flight-trajectory) |

### Searching for an aircraft

The interface is in French by default; the English labels, shown with the language switch, are given in brackets.

1. Open **Aéronefs** (*Aircraft*) in the navigation bar.
2. Fill one or more criteria: the start of the ICAO24 address (for example `3c64`), part of the registration (`F-GK`), part of the airline name or code (`Air France`, `AFR`). Case does not matter.
3. To search an area, fill its four bounds in degrees: south and north latitudes, west and east longitudes. The area applies to the latest known position of each aircraft.
4. Select **Rechercher** (*Search*). The matching aircraft are listed with their model, airline and last contact, and those with a known position are shown on the map. The shade of a marker gives the altitude of the aircraft: below FL150, FL150 to FL300, above FL300.
5. Select an aircraft to open its record.

If nothing matches, the page says so: broaden the criteria, for example by shortening the address or removing a criterion.

### Aircraft record

The record (**Fiche aéronef**) shows the address, registration, model, airline and last contact of the aircraft, its latest position on the map, its flights and its latest 50 observations, newest first: time, altitude (m), speed (m/s), heading (°), position and whether the aircraft was on the ground. A dash means OpenSky did not send the value. Times, codes and measured values are set in a monospaced font so that they line up. Select a flight to open its trajectory.

### Flight trajectory

The flight page shows the trajectory on the map, with the latest position marked, then the statistics (duration, distance, mean and maximum altitude and speed, number of observations) and the altitude and speed profiles.

When observations are missing for more than 5 minutes, the trajectory is partial: a warning lists the missing segments and the map does not join the points on either side of a gap. The distance leaves those segments out.

The map shows OpenStreetMap tiles. The aircraft data comes from the OpenSky Network, credited on the map.

## Supervisor

The Supervisor can also search for and view aircraft (UC-01). Only the dashboard, the alerts and the rules appear in the project sheet; processing alerts, adjusting thresholds and managing accounts come from the specifications (A-02).

| Task | Use case | Instructions |
| --- | --- | --- |
| Open the supervision dashboard | UC-04 | `TBD` |
| Filter and sort alerts by rule, period or aircraft | UC-04 | See [Alerts](#alerts) |
| View the details of an alert and mark it as processed | UC-04 | See [Alerts](#alerts) |
| View and adjust the thresholds of a rule | UC-05 | See [Rules](#rules) |
| Create, modify or deactivate accounts and assign roles | UC-06 | `TBD` |
| Compare rule alerts with AI anomaly scores (bonus) | UC-07 | `TBD` |

### Alerts

After each data collection, the rules engine checks rules R1 to R5 on every airborne aircraft heard in the last 30 minutes. When a value exceeds its threshold, an alert is raised. An aircraft raises one alert per rule and per situation: no new alert comes while the situation lasts. The rules are described in [business rules](business-rules.md).

1. Open **Alerts** in the navigation bar. The page first lists the alerts not yet processed, the latest first.
2. To narrow the list, choose a rule, a status, a criticality, the start of an ICAO24 address or a period, then select **Apply**. The status can be:
   - **Not processed**: no Supervisor has handled the alert yet;
   - **Situation still active**: the value is still above the threshold;
   - **Processed**: a Supervisor marked the alert as processed.
3. **Sort by** date, criticality or rule, in descending or ascending order. Use **Previous** and **Next** to move between pages of 25 alerts.
4. Select **Details** to see the aircraft, the rule, the trigger time, the observed value, the threshold in force at that time, the criticality and the message. The aircraft name opens its record.
5. Select **Mark as processed** once the alert has been handled. An alert is processed only once: the page says so if another Supervisor already did it.

If an alert is not relevant, the details offer a link to adjust the threshold of its rule.

### Rules

1. Open **Rules** in the navigation bar. Each rule shows what it detects, its threshold with its unit, its criticality, whether it is evaluated and its last change.
2. Change the threshold, the criticality or the **evaluated** box of a rule, then select **Save** on its row. The button stays disabled until a setting changes, and for a negative or empty threshold.

The change applies at the next evaluation, within one collection period. Alerts already raised keep the threshold in force when they were triggered. Every change is recorded with its author in the audit log.

## Dashboard content

The project sheet does not describe the dashboard content (A-04). The specifications say it shows an overview of tracked aircraft and alerts (§VI.1.7):

- number of alerts by rule and by period;
- the aircraft most often concerned;
- recent alerts;
- status indicators for the data collection system.
