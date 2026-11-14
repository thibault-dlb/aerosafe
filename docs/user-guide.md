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

### Moving around

Once logged in, the side bar on the left lists the pages you can open: the dashboard and the aircraft, and, for a Supervisor, the alerts (with the number of active ones), the rules and the accounts. Your account and **Se déconnecter** (or **Log out**) are at its foot. **Replier la barre** (or **Collapse the side bar**) folds it into a rail of icons; the choice is kept. On a phone, the menu button at the top left opens the bar over the page; the Escape key, a link or a tap outside closes it. The thin bar at the top names the page and holds the choice between live data and the replay, the language and the theme. An address that does not exist shows the "lost contact" page, with a way back.

Coverage of air traffic depends on the OpenSky Network receiver network and is not uniform across regions.

## User

| Task | Use case | Instructions |
| --- | --- | --- |
| Search for an aircraft by ICAO24, registration, airline or an area drawn on the map | UC-01 | See [Searching for an aircraft](#searching-for-an-aircraft) |
| View an aircraft record and its observation history | UC-01 | See [Aircraft record](#aircraft-record) |
| View a flight trajectory on a map, with altitude and speed profiles | UC-02 | See [Flight trajectory](#flight-trajectory) |
| View flight statistics | UC-02 | See [Flight trajectory](#flight-trajectory) |

### Searching for an aircraft

The interface is in French by default; the English labels, shown with the language switch, are given in brackets.

1. Open **Aéronefs** (*Aircraft*) in the side bar.
2. Type what you know in the one field: the start of the ICAO24 address (`3c64`, six characters at most), the registration (`F-GKXA`, or its start `F-GK`; an American one such as `N123AB`) or the airline (`Air France`, `AFR`). The page tells how it understood the text (*Recherche comprise comme*), so a mistake shows at once. Case does not matter.
3. To search an area, select **Tracer une zone** (*Draw an area*) and drag a rectangle on the map. The area applies to the latest known position of each aircraft, and the search starts as soon as the rectangle is drawn. The area stays under the field as a filter: select its cross to remove it. The text and the area combine.
4. Select **Chercher** (*Search*). The matching aircraft are listed beside the map with their altitude, model, airline and last contact, and those with a known position are drawn on it. A marker is a silhouette turned the way the aircraft flies; its shade gives the altitude (below FL150, FL150 to FL300, above FL300), and an aircraft on the ground is a hollow diamond. Pointing at an aircraft in the list rings it on the map.
5. Select an aircraft to open its record.

If nothing matches, the page says so: broaden the criteria, for example by shortening the address or removing the area.

### Aircraft record

The record (**Fiche aéronef**) starts with a banner: the name of the aircraft, its model, airline and address, whether it is in the air or on the ground, and four figures (altitude, ground speed, heading and last contact). A Supervisor also sees there the number of alerts in progress for the aircraft and their highest criticality, and the marker on the map takes the colour of that criticality and pulses. Under the banner come the map with the latest position, the flights, and the latest 50 observations, newest first: time, altitude, speed, heading, position and state. A dash means OpenSky did not send the value. The path at the top (*Aéronefs › F-GKXA*) leads back. Select a flight to open its trajectory.

### Flight trajectory

The flight page starts with a banner: the callsign, the aircraft, the route (an unknown destination reads *arrivée inconnue*) and the statistics: duration, distance, maximum altitude and speed (the mean under each) and number of observations. Under it come the trajectory on the map, ending on the aircraft turned to its last heading, and the altitude and speed profiles. Point at a profile to read the value and the time under the pointer.

When observations are missing for more than 5 minutes, the trajectory is partial: a warning lists the missing segments, the map does not join the points on either side of a gap, and the profiles are cut and shaded there. The distance leaves those segments out.

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

1. Open **Alertes** (or **Alerts**) in the side bar. The page first lists the alerts not yet processed, the latest first, and says how many there are.
2. The chips above the list filter at once. The first group is the status: **Non traitées** (no Supervisor has handled the alert yet), **En cours** (the situation lasts: the value is still above the threshold), **Traitées** (a Supervisor marked the alert as processed) or **Toutes**. The second group is the criticality; select a level to keep only its alerts, and select it again to remove the filter. **Plus de filtres** opens the others: the rule, the start of an ICAO24 address and a period; select **Appliquer** to use them, or **Effacer les filtres** to start again.
3. Each row starts with the criticality as a shape: a filled diamond for high, a filled triangle for medium, a hollow circle for low. The shape is the same in every page, so an alert is read at first glance, with or without colour. Select the title of a column (criticality, rule, date) to sort by it, and again to reverse the order. Use the page numbers under the list to move between pages of 25 alerts.
4. Select a row to open its details beside the list (under it on a narrow screen): the rule with a small animated drawing of what it measures, the value observed against the threshold in force at that time, the aircraft (its name opens its record), whether the situation lasts, the processing and the message.
5. Select **Traiter** on a row, or **Marquer comme traitée** in the details, once the alert has been handled. A notification confirms it. An alert is processed only once: the page says so if another Supervisor already did it.

If an alert is not relevant, the details offer a link to adjust the threshold of its rule.

### Rules

1. Open **Règles** (or **Rules**) in the side bar. Each rule is a card: its pictogram, what it detects, a small animated drawing of its threshold, the threshold with its unit, the criticality of its alerts, a switch that says whether it is evaluated, and the date of its last change.
2. Change the threshold, the criticality or the switch of a rule. The card gets a gold border and a **Enregistrer** button appears; select it to save. A negative or empty threshold is refused under its field. A notification confirms the save.

The change applies at the next evaluation, within one collection period. Alerts already raised keep the threshold in force when they were triggered. Every change is recorded with its author in the audit log. Thresholds are always entered in metric units, whatever the units chosen for the display.

## Dashboard content

The project sheet does not describe the dashboard content (A-04). The specifications say it shows an overview of tracked aircraft and alerts (§VI.1.7):

- number of alerts by rule and by period;
- the aircraft most often concerned;
- recent alerts;
- status indicators for the data collection system.
