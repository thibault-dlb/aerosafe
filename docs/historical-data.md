# Historical data

Exploration of the sources that could let AeroSafe run on past air traffic instead of the live OpenSky REST API. Checked on 2026-11-09. Nothing here is decided: collection stays live only (D-05 in [open points](open-points.md)), and a historical mode would need D-05 to be reopened.

## Why

Today the collector only reads the live state vectors of the OpenSky REST API ([architecture](architecture.md#data-source), [OpenSky Network](opensky.md)). The only history is what AeroSafe has collected itself. A historical mode would let the team replay a past period, for demonstrations and tests, without spending OpenSky credits or waiting for traffic.

## OpenSky historical database (Trino)

Source: [Trino documentation](https://openskynetwork.github.io/opensky-api/trino.html).

| Topic | What OpenSky says | Consequence for AeroSafe |
| --- | --- | --- |
| Eligibility | Open to "university-affiliated researchers, governmental organisations, and aviation authorities", on application (My OpenSky, Request Data Access). OpenSky may "decline applications lacking sufficient justification" | **Blocking.** A course project is not clearly eligible. The application should come from, or be supported by, the supervising teacher |
| Data | `state_vectors_data4` since 2013, with the same fields as the REST API (`icao24`, `callsign`, position, altitudes, `velocity`, `heading`, `onground`, `lastposupdate`, `lastcontact`); `flights_data4` since 2016, with estimated origin and destination airports | Maps directly to `OBSERVATION`; would also fill the airports that are postponed |
| Limits | Every query must filter on the `hour` partition; 2 running and 2 queued queries per user; 30 minutes per query; 100 GB scanned at most. Users who ignore the guidelines are banned | Queries are too slow for an interactive mode: a historical mode would be an import into PostgreSQL, then a replay |
| Access from Python | pyopensky reads a username and password from its configuration file or from `OPENSKY_USERNAME` and `OPENSKY_PASSWORD`; a browser login is the last fallback | Should work on a server without a browser, to be tested |
| Known gaps | Data lost during several outages between 2023 and 2026 | Avoid those periods |

## Downloadable datasets

Source: [Scientific Datasets](https://opensky-network.org/data/scientific) and the file bucket behind [opensky-network.org/datasets](https://opensky-network.org/datasets/), every link opened.

| # | Dataset | Available | Use for AeroSafe |
| --- | --- | --- | --- |
| d1 | Weekly 24 hours of state vector data (2017 to 2022, every 10 s, CSV, Avro, JSON) | **No**: the `states/` folder holds only a placeholder since 2026-11-04 | Would have been ideal |
| d2 | Raw data samples | **No**: emptied on 2026-11-04 | None (radio layer) |
| d3 | [LocaRDS](https://zenodo.org/records/4739276), CC BY-SA 4.0, 3.6 GB | Yes | Partial: real trajectories over Europe, but anonymised aircraft (an integer), no callsign, speed, heading or `on_ground`, relative time, some positions removed |
| d4 | [COVID-19 flight dataset](https://zenodo.org/records/7923702) (2019 to 2022, monthly CSV, 8.1 GB; a [CC BY version](https://zenodo.org/records/3931948) up to 2021) | Yes | Flights only: one row per flight with its first and last position, so no trajectory and no rules |
| d5 | Aircraft metadata database (monthly CSV, latest complete one `aircraft-database-complete-2025-08.csv`, 108 MB; ICAO Doc 8643 types and manufacturers) | Yes | Fills the registration, `R_MODELE` and `R_COMPAGNIE` (import postponed, see [data model](data-model.md)); terms to check first |
| d6 | [In-flight emergencies](https://zenodo.org/records/3937483) (squawk 7700, 2018 to 2020, parquet, 131 MB), OpenSky licence | Yes | Real emergency trajectories to test the alerts; file not opened yet |
| d7 | Climbing aircraft dataset (ENAC, 2017, 68 GB) | Yes | None: anonymised, research oriented |
| d8 | GICB capabilities | Yes | None (transponder capabilities) |
| d9 | [ADS-C](https://zenodo.org/records/10041840) | Yes | None (satellite messages over oceans) |
| d10 | [PRC Data Challenge 2024](https://doi.org/10.4121/8cb8484b-dbe7-4750-8b87-a5b1dbc621b4), CC BY 4.0 | Yes | **Best candidate**, see below |
| d11 | Complete one-day Trino tables snapshot (1 March 2026) | **No**: emptied on 2026-11-04 | Would have been ideal |

The same bucket also holds `incident-data/`, not listed on the page: five single-aircraft extracts from Trino (all tables, about one row per second) around recent incidents, under CC BY 4.0. They are real abnormal trajectories (diversions, emergencies, a crash), useful as test cases for the rules, but none flies over France.

The emptied folders all got their placeholder on 2026-11-04, so the files were probably moved or withdrawn recently. Asking OpenSky (contact[at]opensky-network.org) where they went is worth it.

## PRC Data Challenge 2024 dataset (d10)

Published by EUROCONTROL's Performance Review Commission, OpenSky, TU Delft and ONERA on [4TU.ResearchData](https://doi.org/10.4121/8cb8484b-dbe7-4750-8b87-a5b1dbc621b4) (version 2, 2025-07-14), with its [data description](https://ansperformance.eu/study/data-challenge/dc2024/data.html).

- **Flights:** 527 162 flights in Europe in 2022 (6.1 % of the flights in EUROCONTROL airspace), in `flight_list.csv` (101 MB): `flight_id`, real departure and arrival airports (`adep`, `ades`, with names and countries), off-block and arrival times, `aircraft_type`, `wtc`.
- **Trajectories:** one parquet file per day (`2022-01-01.parquet` to `2022-12-31.parquet`, 0.5 to 1 GB each, about 158 GiB in all), from OpenSky state vectors, at most one point per second: `flight_id`, `timestamp`, `latitude`, `longitude`, `altitude` (ft), `groundspeed` (kt), `track` (°), `vertical_rate` (ft/min), plus wind and temperature.
- **Licence:** CC BY 4.0. Cite the dataset and the paper *Aircraft Take-off Weight Estimation: The EUROCONTROL PRC 2024 Data Challenge* (Journal of Open Aviation Science, 2025, [doi:10.59490/joas.2025.8252](https://doi.org/10.59490/joas.2025.8252)).

| Need | Covered |
| --- | --- |
| Real dates, trajectories, speed and heading | Yes, after converting ft to m and kt to m/s |
| Flights already grouped, origin and destination airports | Yes |
| Aircraft identity (ICAO24, registration), callsign, airline | No: removed or obfuscated |
| `on_ground` | No: to derive from altitude and speed |
| Full traffic | No: a sample of the flights whose airline gave its take-off weight, 30 aircraft types. Each trajectory runs from 5 minutes before off-block to 30 minutes after arrival, so aircraft also appear on the ground |

A replay would import one or more days, keep the France area, keep one point every 30 s or 120 s like the live profiles, and give each snapshot's own time to the rules engine as `now`. The aircraft would be anonymous.

### Download one day

The files go outside the repository: it is public and collected data is never committed ([project terms](project-terms.md)). One day, the flight list and the README are about 1.1 GB. 4TU accepts partial downloads, so running the command again resumes an interrupted download.

```powershell
$dir = "$HOME\aerosafe-data\prc2024"; New-Item -ItemType Directory -Force $dir | Out-Null; $base = "https://data.4tu.nl/file/8cb8484b-dbe7-4750-8b87-a5b1dbc621b4"; $files = [ordered]@{ "README.txt" = "3564b87c-f1fc-4414-975c-641232da52bf"; "flight_list.csv" = "2bfbef1a-a75b-4045-a46e-3325bf363c27"; "2022-07-01.parquet" = "723a31eb-1d02-401c-a777-eee6366bc38f" }; $i = 0; foreach ($name in $files.Keys) { $i++; Write-Host "`n[$i/$($files.Count)] $name" -ForegroundColor Cyan; curl.exe -L --fail -C - --progress-bar -o "$dir\$name" "$base/$($files[$name])" }; Write-Host "`nDone: $dir" -ForegroundColor Green
```

Other days are listed on the 4TU page, each with its own file link.

## Next steps

1. Test d10 on one day: check the columns and count the flights over France.
2. Ask OpenSky where the d1 and d11 files went, together with V-01.
3. If the team keeps a historical mode, reopen D-05 in [open points](open-points.md), and record the source of each collection run (live or import) in a reference table, following the [database conventions](database-conventions.md).
