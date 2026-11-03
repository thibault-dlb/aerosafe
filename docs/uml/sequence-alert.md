# Sequence diagram: detection and generation of an alert

Source: project sheet §4 and §6, with the team decisions of 2026-11-03 listed in [open points](../open-points.md). Data collection and rule evaluation run as scheduled tasks inside the API process. The frequency is `TBD` (D-05).

```mermaid
sequenceDiagram
  autonumber
  participant S as Scheduler
  participant C as DataCollector
  participant O as OpenSky Network
  participant DB as PostgreSQL
  participant E as RulesEngine
  actor Sup as Supervisor
  participant D as Dashboard (web interface)
  participant API as API

  Note over S,DB: Collection (UC-08)
  S->>C: run collection
  C->>O: request aircraft states
  alt source available
    O-->>C: states
    C->>C: clean and normalise<br/>(drop incomplete records)
    C->>DB: store aircraft and observations
  else source unavailable or rate-limited
    O--xC: error
    C->>C: log the failure and keep stored data
  end

  Note over S,DB: Evaluation (UC-03)
  S->>E: run evaluation
  E->>DB: read active rules and their thresholds
  E->>DB: read recent observations
  loop each rule R1 to R5, each aircraft
    E->>E: compute the observed value
    alt value exceeds the threshold
      E->>DB: store the alert<br/>(aircraft, rule, time, value, threshold, message)
    else no threshold exceeded
      E->>E: log the evaluation, no alert
    end
  end

  Note over Sup,DB: Supervision (UC-04)
  Sup->>D: open the dashboard
  D->>API: get alerts (filter, sort)
  API->>DB: read alerts
  DB-->>API: alerts
  API-->>D: alerts and overview
  D-->>Sup: display
  Sup->>D: mark an alert as processed
  D->>API: process alert
  API->>DB: set processing date and user
  API-->>D: updated alert
```

## Notes

- The Scheduler is internal to the API: no separate worker container (team decision).
- When OpenSky is unavailable, the application keeps working on the stored history, and the failure is logged (traceability of the specifications, not in the project sheet).
- Each trigger and each evaluation without alert is logged, so that an alert can be replayed and explained (specifications NF-08, not in the project sheet).
- The threshold stored in the alert is the one used at trigger time, even if the Supervisor changes the rule afterwards (UC-05).
- Marking an alert as processed records the Supervisor and the date. The database write is one transaction ([database conventions](../database-conventions.md) §10).
- If the AI module is added (bonus), it follows the same pattern: it reads the stored observations, stores an anomaly score, and may raise an alert.
