# User guide

The application is built. Searching for an aircraft, the aircraft record, the flight trajectory with its statistics, the alerts, the rules, the accounts, the account page, the way a Supervisor creates accounts, the dashboard (for every role) and the replay work and are described below. Only the optional AI comparison (UC-07) is not built. This page lists what each profile can do, according to the project sheet and the specifications.

> **Disclaimer:** AeroSafe is an educational project. It is not a certified air traffic surveillance or management system and must not be used operationally. This limitation is also shown in the application (§VII.3).

Access to the application requires authentication. Each account has one role, User or Supervisor, which determines the features available.

### Signing up and logging in

1. Open the application. Only the home page is public: any other address takes you to the log in screen, and brings you back to the page you asked for once you are logged in.
2. To create an account, choose **Inscription** (or **Sign up**), give an e-mail address and a password of 12 characters at least, and confirm. The gauge under the password shows how far you are from the 12 characters. You are logged in at once and the account has the User role.
3. To log in, choose **Connexion** (or **Log in**), give your e-mail address and your password, and confirm. After five failed attempts in a row the account is locked for 15 minutes.
4. The session stays open when you reload the page. To close it, use **Se déconnecter** (or **Log out**) in the bar.
5. A Supervisor can create your account instead of you: they give you a provisional password. Log in with it as usual. The page that follows, **Choisissez votre mot de passe** (*Choose your password*), is the only one that opens until you have chosen your own password (12 characters at least, different from the provisional one): nothing else in the application works before.

The Supervisor pages (alerts, rules, accounts) show an "access restricted" page to a User.

### Moving around

Once logged in, the side bar on the left lists the pages you can open: the dashboard and the aircraft, and, for a Supervisor, the alerts (with the number of active ones), the rules and the accounts. Your account and **Se déconnecter** (or **Log out**) are at its foot. **Replier la barre** (or **Collapse the side bar**) folds it into a rail of icons; the choice is kept. On a phone, the menu button at the top left opens the bar over the page; the Escape key, a link or a tap outside closes it. The thin bar at the top names the page and holds the choice of the data, **OpenSky**, **adsb.fi** (the default) or **Rejeu** (*Replay*), the language and the theme. An address that does not exist shows the "lost contact" page, with a way back.

### My account

Select your e-mail address, at the foot of the side bar, to open **Mon compte** (*My account*). It is open to every role.

- **Informations**: your e-mail address and your role.
- **Mot de passe** (*Password*): give the current password, then the new one (12 characters at least; the gauge shows how far you are). Your other sessions are closed, and you stay logged in here. After five failures in a row the page waits 15 minutes, like the log in.
- **Préférences** (*Preferences*): the language and the **units**: metric (metres, kilometres per hour for the ground speed, kilometres) or aeronautical (feet, knots, nautical miles). The application has a single theme, the dark one. They are kept in this browser. The units change what the pages show (altitudes, speeds, distances); the thresholds of the rules stay in metric units.
- **Supprimer mon compte** (*Delete my account*): after your password is asked again, your e-mail address and your password are erased, your sessions are closed and you leave for the home page. The history stays, without identifying you; it cannot be undone. The last active Supervisor cannot delete their account: give the role to another account first.

The live traffic comes from two sources collected in parallel, and the top bar picks the one shown: **adsb.fi**, refreshed every 5 seconds over 250 NM around Paris, with positions less than 3 seconds old, and **OpenSky**, refreshed every 30 seconds over Île-de-France, which covers the ground of the airports better. Each source has its own aircraft and alerts. Their coverage depends on their receiver networks and is not uniform across regions; see [data sources](data-sources.md).

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

The record (**Fiche aéronef**) starts with a banner: the name of the aircraft, its model, airline and address, whether it is in the air or on the ground, and four figures (altitude, ground speed, heading and last contact). A Supervisor also sees there the number of alerts in progress for the aircraft and their highest criticality, and the marker on the map takes the colour of that criticality and pulses. Under the banner come the map with the latest position, the flights, and the latest 50 observations, newest first: time, altitude, speed, heading, position and state. A dash means the source did not send the value. The path at the top (*Aéronefs › F-GKXA*) leads back. Select a flight to open its trajectory.

### Flight trajectory

The flight page starts with a banner: the callsign, the aircraft, the route (an unknown destination reads *arrivée inconnue*) and the statistics: duration, distance, maximum altitude and speed (the mean under each) and number of observations. Under it come the trajectory on the map, ending on the aircraft turned to its last heading, and the altitude and speed profiles. Point at a profile to read the value and the time under the pointer.

When observations are missing for more than 5 minutes, the trajectory is partial: a warning lists the missing segments, the map does not join the points on either side of a gap, and the profiles are cut and shaded there. The distance leaves those segments out.

The map is a dark radar-style map drawn by the application, with the airports and their ICAO codes. The aircraft data comes from the OpenSky Network or adsb.fi, credited in the footer of every page, with a link to adsb.fi.

## Supervisor

The Supervisor can also search for and view aircraft (UC-01). Only the dashboard, the alerts and the rules appear in the project sheet; processing alerts, adjusting thresholds and managing accounts come from the specifications (A-02).

| Task | Use case | Instructions |
| --- | --- | --- |
| Open the supervision dashboard | UC-04 | See [Dashboard](#dashboard) |
| Filter and sort alerts by rule, period or aircraft | UC-04 | See [Alerts](#alerts) |
| View the details of an alert and mark it as processed | UC-04 | See [Alerts](#alerts) |
| View and adjust the thresholds of a rule | UC-05 | See [Rules](#rules) |
| Create, modify or deactivate accounts and assign roles | UC-06 | See [Accounts](#accounts) |
| Compare rule alerts with AI anomaly scores (bonus) | UC-07 | `TBD` |

### Accounts

Open **Comptes** (*Accounts*) in the side bar. The table lists every account, oldest first, 20 a page: the e-mail address, the role, the state, the creation date and the actions. **Rechercher un compte** looks for part of an e-mail address.

1. To create an account, select **Créer un compte**, give the e-mail address and the role (User by default) and confirm. The application generates a **provisional password** and shows it once, with a button to copy it. Give it to the owner: it is not kept anywhere and cannot be shown again. The owner chooses their own at the first login, and until then the table shows **Mot de passe provisoire** under the account.
2. To change a role, choose the other one in the list of the account. To deactivate an account, switch **Actif** off: its sessions end at once and it can no longer log in. Switch it on to reactivate it. A notification confirms each change.
3. To anonymise an account, select **Anonymiser**, then type the word asked (**ANONYMISER**) and confirm. The e-mail address and the password are erased and the sessions closed; the history stays. The account remains in the list, greyed, and nothing more can be done to it. It cannot be undone.

You cannot change your own account in this list (its controls are off and marked *vous*): use your account page. The last active Supervisor cannot be demoted, deactivated or anonymised.

### Alerts

After each data collection, the rules engine checks rules R1 to R5 on every airborne aircraft heard in the last 30 minutes. When a value exceeds its threshold, an alert is raised. An aircraft raises one alert per rule and per situation: no new alert comes while the situation lasts. The rules are described in [business rules](business-rules.md).

1. Open **Alertes** (or **Alerts**) in the side bar. The page first lists the alerts not yet processed, the latest first, and says how many there are.
2. The chips above the list filter at once. The first group is the status: **Non traitées** (no Supervisor has handled the alert yet), **En cours** (the situation lasts: the value is still above the threshold), **Traitées** (a Supervisor marked the alert as processed) or **Toutes**. The second group is the criticality; select a level to keep only its alerts, and select it again to remove the filter. **Plus de filtres** opens the others: the rule, the start of an ICAO24 address and a period; select **Appliquer** to use them, or **Effacer les filtres** to start again.
3. Each row starts with the criticality as a shape: a filled diamond for high, a filled triangle for medium, a hollow circle for low. The shape is the same in every page, so an alert is read at first glance, with or without colour. Select the title of a column (criticality, rule, date) to sort by it, and again to reverse the order. Use the page numbers under the list to move between pages of 25 alerts.
4. Select a row to open its details beside the list (under it on a narrow screen): the rule with a small animated drawing of what it measures, the value observed against the threshold in force at that time, the aircraft (its name opens its record), whether the situation lasts, the processing and the message.
   The vertical rate of rule R3 keeps its sign: **-40 m/s** is a descent, **40 m/s** a climb, and the rule triggers on the size of the rate. Alerts raised before this change keep the unsigned value they were stored with. The dashboard can also open an alert here (see the dashboard): the page then opens its details and highlights its row.
5. Select **Traiter** on a row, or **Marquer comme traitée** in the details, once the alert has been handled. A notification confirms it. An alert is processed only once: the page says so if another Supervisor already did it.

If an alert is not relevant, the details offer a link to adjust the threshold of its rule.

### Rules

1. Open **Règles** (or **Rules**) in the side bar. Each rule is a card: its pictogram, what it detects, a small animated drawing of its threshold, the threshold with its unit, the criticality of its alerts, a switch that says whether it is evaluated, and the date of its last change.
2. Change the threshold, the criticality or the switch of a rule. The card gets a gold border and a **Enregistrer** button appears; select it to save. A negative or empty threshold is refused under its field. A notification confirms the save.

The change applies at the next evaluation, within one collection period. Alerts already raised keep the threshold in force when they were triggered. Every change is recorded with its author in the audit log. Thresholds are always entered in metric units, whatever the units chosen for the display.

### Dashboard

**Tableau de bord** (*Dashboard*) is the first page of the side bar, open to every role. It follows the choice of the data in the top bar: OpenSky, adsb.fi or the replay (when the replay is chosen, a small player floats at the bottom of the page: see below). The figures and the aircraft refresh by themselves at the pace of the source: every 5 seconds for adsb.fi, every 30 seconds for OpenSky; in the replay the figures every 5 seconds and the aircraft every one or two seconds. The map shows the aircraft heard in the last minute.

- **The four figures**: aircraft followed on the map, active alerts (the situation lasts), alerts to process, alerts of the last 24 hours.
- **The map** fills the screen and the other blocks float over it. It shows every aircraft of the area, turned along their heading (a diamond on the ground), moving smoothly between two reports: **their position between two reports is an estimate** at their last heading and speed. An aircraft with an active alert takes its criticality colour and pulses. In front of each aircraft a thin line shows where it will be in the next 15 minutes if it keeps its heading and speed. An aircraft not heard for 90 seconds stops, fades and loses its line. The replay outlines the area of the imported data (France plus 100 km), OpenSky its Île-de-France box and adsb.fi its circle of 250 NM around Paris; range rings every 50 NM are drawn around Paris. The map never moves by itself: you can zoom out until the whole of France shows, with the neighbouring countries. In the column at the right, **Alertes actives** folds the panel, and under it the buttons **Recentrer sur la zone** (shows the whole area again), full screen and zoom stay in place whether the panel is open or not; the panel opens under the buttons.
- **Following an aircraft**: click an aircraft, click a row of the alerts (see below), or type its registration or ICAO24 in **Suivre un aéronef**. The map keeps it at the centre until you move the map (the **Suivi** button follows it again), a dotted line behind it shows **everything known of its flight**, and its card shows, updated twice a second, its altitude, ground speed, heading, the time since its last contact, its estimated position, its active alert, and the profile of its altitude over the whole flight, in the units chosen in the preferences. **Ouvrir la fiche** opens its record. On a phone the card takes the bottom of the map.
- **Alertes actives** (*Active alerts*): the latest ones, as a table. A Supervisor marks an alert as processed with **Traiter** and opens **Voir les N alertes actives** to reach the alerts page. A User reads the same table, without these two controls. **A click on an alert centres the map on its aircraft** (the map zooms in if it is zoomed out, and follows the aircraft, whose row is highlighted); **a second click on the same alert opens it in the alerts page** (Supervisor only), where its details are open, its row highlighted and the list narrowed to the alerts of its aircraft, all situations included. A User has no alerts page: the second click does nothing. An alert whose aircraft is not on the map opens in the alerts page at once.
- **Alertes par règle** (*Alerts per rule*): bars stacked by rule, one per hour over 24 hours, one per day over 7 or 30 days. Each rule keeps its colour and its letter in the legend. **Afficher les données** (*Show the data*) opens the same figures as a table.
- **Collecte adsb.fi** or **Collecte OpenSky** (*adsb.fi collection*, *OpenSky collection*), after the source shown (adsb.fi in the replay): the state (active, running, paused, disabled), its pace, its precision, the last successful run, the credits left (OpenSky only) and the latest cycles (green for a run that collected, red for one that did not). A Supervisor also gets **Mettre en pause** / **Reprendre** (*Pause* / *Resume*) and **Lancer maintenant** (*Run now*, which uses OpenSky credits for OpenSky), which act on that source only; a notification confirms the action. A User reads the state only.

**The replay player.** When **Rejeu** (*Replay*) is chosen in the top bar of the application, a small player floats at the bottom of every page, over the content and over the map in full screen. It shows the simulated time in UTC, **Pause** / **Reprendre** and the speeds ×1, ×10 and ×60. The button with the clock opens the choice of the instant to start at (**Démarrer à (UTC)**) and the period available; it opens by itself while the replay has not started. Only a Supervisor can drive the clock, and it is the same for everybody. The home page has no replay: the choice of the data source is made inside the application.

A part that cannot be loaded shows a warning and the others stay. In the replay, a replay that was not started shows no alert.

## Dashboard content

The project sheet does not describe the dashboard content (A-04). The specifications say it shows an overview of tracked aircraft and alerts (§VI.1.7):

- number of alerts by rule and by period;
- the aircraft most often concerned;
- recent alerts;
- status indicators for the data collection system.
