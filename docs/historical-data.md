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
- **Trajectories:** one parquet file per day (`2022-01-01.parquet` to `2022-12-31.parquet`, 0.25 to 1.2 GB each, about 285 GiB in all), from OpenSky state vectors, at most one point per second: `flight_id`, `timestamp`, `latitude`, `longitude`, `altitude` (ft), `groundspeed` (kt), `track` (°), `vertical_rate` (ft/min), plus wind and temperature.
- **Licence:** CC BY 4.0. Cite the dataset and the paper *Aircraft Take-off Weight Estimation: The EUROCONTROL PRC 2024 Data Challenge* (Journal of Open Aviation Science, 2025, [doi:10.59490/joas.2025.8252](https://doi.org/10.59490/joas.2025.8252)).

| Need | Covered |
| --- | --- |
| Real dates, trajectories, speed and heading | Yes, after converting ft to m and kt to m/s |
| Flights already grouped, origin and destination airports | Yes |
| Aircraft identity (ICAO24, registration), callsign, airline | No: `icao24` is an obfuscated integer (one per flight, never the real code), the callsign and the airline are hashes, there is no registration |
| `on_ground` | No: to derive from altitude and speed |
| Full traffic | No: a sample of the flights whose airline gave its take-off weight, 30 aircraft types. A trajectory starts at most 5 minutes before off-block and ends at most 30 minutes after arrival, but most start later, where the coverage begins: on 2022-07-01, 78 % of the listed flights already move at their first point, and only 0.05 % of the points are under 40 kt, so the ground is almost absent |

A replay would import one or more days, keep the France area, keep one point every 30 s or 120 s like the live profiles, and give each snapshot's own time to the rules engine as `now`. The aircraft would be anonymous.

### Download one day

The files go to `data/prc2024` at the repository root, a folder that `.gitignore` excludes: the repository is public and collected data is never committed ([project terms](project-terms.md)). Run the commands from the repository root. One day, the flight list and the README are about 1.1 GB. 4TU accepts partial downloads, so running the command again resumes an interrupted download.

```powershell
$dir = "data\prc2024"; New-Item -ItemType Directory -Force $dir | Out-Null; $base = "https://data.4tu.nl/file/8cb8484b-dbe7-4750-8b87-a5b1dbc621b4"; $files = [ordered]@{ "README.txt" = "3564b87c-f1fc-4414-975c-641232da52bf"; "flight_list.csv" = "2bfbef1a-a75b-4045-a46e-3325bf363c27"; "2022-07-01.parquet" = "723a31eb-1d02-401c-a777-eee6366bc38f" }; $i = 0; foreach ($name in $files.Keys) { $i++; Write-Host "`n[$i/$($files.Count)] $name" -ForegroundColor Cyan; curl.exe -L --fail -C - --progress-bar -o "$dir\$name" "$base/$($files[$name])" }; Write-Host "`nDone: $dir" -ForegroundColor Green
```

Other days are listed on the 4TU page, each with its own file link.

### Download the whole year

`scripts/download-prc2024.ps1` downloads the 365 daily files, the flight list and the README (367 files, about 285 GiB, so check the free disk space) into `data/prc2024`. It reads the file list from the 4TU API, skips the files that are already complete, resumes the interrupted one, retries after a network error, and shows the progress of the current file and of the whole download (speed, elapsed and remaining time). `-DryRun` only prints the plan.

```powershell
.\scripts\download-prc2024.ps1
```

### Verify the files, and a copy of them

`scripts/verify_prc2024.py` reads every column of every row of the 365 files (about 306 GB, several minutes, one progress line a file, DuckDB limited to 6 threads) and keeps, for each file, its size, its number of rows and a checksum of all its values; `flight_list.csv` and the README get a SHA-256. `write` records them in `data/prc2024/MANIFEST.csv` on a folder known to be good, `check` compares a folder with that manifest, so a copy that lost or changed a byte is found. The manifest is copied with the data (the `data` folder is not versioned).

```powershell
uv run scripts/verify_prc2024.py write data/prc2024
uv run scripts/verify_prc2024.py check data/prc2024
```

### Test on one day (2022-07-01)

Checked on 2026-11-09 with pyarrow on the files above.

| Topic | Finding | Consequence |
| --- | --- | --- |
| Size | 21 553 036 points, 3 273 flights, between 2022-07-01 00:22 and 2022-07-02 12:22 UTC (the file also holds the end of flights that started late in the day) | The file is not limited to its calendar day: filter on `timestamp` |
| Sampling | One point per second (median step 1 s, at most 2 s) | Downsample to 30 s or 120 s |
| Columns | The parquet also holds `icao24` (obfuscated integer) and the ERA5 weather columns (`u_component_of_wind`, `v_component_of_wind`, `temperature`, `specific_humidity`) | Weather is not needed; ignore it |
| Missing values | `groundspeed`, `track` and `vertical_rate` are null on 83 525 points (0.4 %); position and altitude are never null | Drop or keep the point with a null speed, to decide |
| Outliers | 3 542 points above 60 000 ft, 689 below −500 ft, 1 447 above 700 kt (maximum 3 921 kt) | Filter before the rules, otherwise they raise false alerts |
| Over metropolitan France (latitude 41.3 to 51.1, longitude −5.2 to 9.6) | 1 272 flights, 3 740 123 points, so about 31 000 points at one every 120 s | Small enough to import into PostgreSQL |
| Over Île-de-France (latitude 48.0 to 49.3, longitude 1.4 to 3.6) | 312 flights, 180 306 points, so about 6 000 points at one every 30 s | Same |
| Link with the flight list | Only 1 640 of the 3 273 trajectories match a row of `flight_list.csv` (1 641 rows are dated 2022-07-01). Over the year: 979 680 trajectories for 527 162 rows, so 452 518 trajectories (46 %) have no row. The README only counts the flights "with complete weight information", so they are probably flights without a take-off weight (not checked) | Almost half of the trajectories have no origin, destination, type or country |
| Anonymisation | 30 airlines and 11 692 callsigns, all hashed | Nothing readable to show in the interface |

### Size of the whole year

Measured on the 365 files on 2026-11-12 (row counts from the parquet metadata, flights and areas from one scan).

- 6 390 198 052 points in 979 680 trajectories, 306 GB, so about 48 bytes a point in parquet. A flight is in exactly one daily file.
- The trajectories are not limited to Europe, since a flight is followed from end to end: on the three days checked (2022-01-15, 2022-07-01 and 2022-12-31), latitudes go from −34° to 69° and longitudes from −123° to 145°.
- Inside metropolitan France (latitude 41.3 to 51.1, longitude −5.2 to 9.6): 1 049 153 028 points, **16.4 %** of the year, at one point per second.

| Selection of the flights (airports of `flight_list.csv`) | Flights | Share of the 527 162 listed flights | Share of the points |
| --- | --- | --- | --- |
| Departure and arrival in Europe (strict: no Turkey, Cyprus, Caucasus, Israel) | 355 360 | 67 % | 29 % |
| Same, with Turkey, Cyprus and the Caucasus | 458 388 | 87 % | 43.5 % |
| Departure and arrival in France | 68 | 0.01 % | 0 % |
| Departure or arrival in France | 34 939 | 6.6 % | 4.0 % |

Few domestic flights: the sample only holds the flights of airlines that gave their take-off weight. A selection by airports drops the 46 % of trajectories that have no row in the list; a selection by area keeps them.

### Area that follows the border, and Europe

Counted on 2026-11-12 on the 365 files, at one point per second, with the `OBSERVATION` size of 318 bytes a point, the speed of 24 600 points a second (a minimum: the indexes slow the inserts as they grow) and the 306 GB of parquet freed by `--delete-source`.

| Area | Points | Share of the year | Size in PostgreSQL | Time | Disk, net of the parquet |
| --- | --- | --- | --- | --- | --- |
| Rectangle `COLLECTION_BBOX_FRANCE` | 1.049 billion | 16.4 % | 334 GB | 11.8 h | +27 GB |
| France without Corsica, exact border | 425 million | 6.6 % | 135 GB | 4.8 h | −171 GB |
| France without Corsica + 50 km | 601 million | 9.4 % | 191 GB | 6.8 h | −115 GB |
| **France without Corsica + 100 km** (`france-100km`) | **856 million** | **13.4 %** | **272 GB** | **9.7 h** | **−34 GB** |

The border is that of Natural Earth (10 m, public domain, a few kilometres of generalisation, which a 100 km margin makes irrelevant), widened in metres in the Lambert-93 projection. Corsica is 166 km from the mainland, so the margin never reaches it. The mask is 1 113 runs of cells (15 KB), `src/api/services/historical/areas/france_100km.csv`, built by `scripts/build_area_mask.py` (run again only to change the area, with `uv run scripts/build_area_mask.py --km 100`). Checked on the data: its area is 0.05 % under the polygon, and the points it keeps are 0.09 % under the exact polygon counted on a coarser grid. The cell of a point is `floor(latitude / 0.01), floor(longitude / 0.01)`, so the border is exact to about 1 km.

Europe, overflights included (a rectangle from 35° to 70° of latitude and −12° to 40° of longitude: 5.50 billion points, 86 % of the year):

| Step | Points | Size in PostgreSQL | Time |
| --- | --- | --- | --- |
| 1 s | 5.50 billion | 1.75 TB | 62 h |
| 5 s | 1.10 billion | about 350 GB | 12 h |
| 10 s | 550 million | 175 GB | 6 h |
| 30 s | 183 million | 58 GB | 2 h |

The import has no `--step` option yet: it keeps the resolution of the dataset. R3 to R5 ignore two points less than 10 s apart, so a step under 10 s would need the engine to compare a point with the one two or more steps before.

## Import into PostgreSQL

`src/api/services/historical` loads the daily files into `AERONEF`, `VOL` and `OBSERVATION`. **Proposal, to confirm with the team** (it needs D-05 to be reopened, see below): the area of metropolitan France, every trajectory (listed or not), clipped to the area, at the resolution of the dataset (one point per second, no downsampling), aircraft anonymous.

| Topic | Rule |
| --- | --- |
| Area | `--area france-100km`: metropolitan France without Corsica, plus 100 km all around, as a mask of cells of 0.01 degree (see below). Without it, a rectangle: `--bbox`, by default the `COLLECTION_BBOX_FRANCE` setting. The points outside are dropped, so an aircraft that leaves the area and comes back more than 30 minutes later makes a second flight |
| Aircraft | One `AERONEF` per flight of the dataset, since the obfuscated `icao24` is the `flight_id`. `CD_ICAO24` is the flight identifier minus 248 000 000, written in six hexadecimal digits (the identifiers go from 248 750 611 to 258 074 492, which fits in 24 bits). Registration, model and airline stay empty |
| Flights | One `VOL` per segment of trajectory, cut when two points are more than `COLLECTION_FLIGHT_GAP_MINUTES` apart (D-06). Callsign and airports stay empty |
| Observations | `DT_DERNIER_CONTACT` and `DT_POSITION` are the time of the point, so **R1 and R2 never fire**. Altitude ft to m, speed kt to m/s, heading rounded to 2 decimals with 360 turned into 0, coordinates rounded to 6 decimals |
| Outliers | An altitude outside −500 to 60 000 ft, a speed below 0 or above 700 kt, a heading outside 0 to 360 become empty and the point is kept, as the collector does with OpenSky: the rules skip a missing value |
| `BL_AU_SOL` | The dataset has no such field. True when the speed is under 40 kt and the altitude under 3 000 ft. A speed under 40 kt at a higher altitude is a glitch: the speed is emptied. A simplification to validate with R4, since a takeoff roll above 40 kt counts as airborne; ground points are only 0.05 % of the data |
| Safety | A database that holds observations dated outside 2022 is refused, since the synthetic codes could collide with real ICAO24 addresses. Use a database of its own |
| Parallelism | The aircraft and flights of a file are committed first, then the batches of 50 000 observations go through a queue to `--workers` tasks (default 5, at most 6), each with its own connection and one transaction per batch. DuckDB is limited to 2 threads. With the client, the import stays within 6 of the 8 cores |
| Restart | A file stopped halfway is completed by running it again: the batches never share a row, a batch already stored is skipped, and a file already complete is recognised by its row count and skipped |
| Check | After each file, the database must hold as many observations for its aircraft as the file holds points, otherwise the command stops with an error and the file is never deleted |

Run from `src/api`, with the password of the target database. Start with a dry run on one day: it reads the file and reports the points, the flights and a rough size, without a database. Then load that day, and compare the time and `pg_total_relation_size('"OBSERVATION"')` with the estimates before loading more.

```powershell
cd src\api
$env:DB_HOST = "127.0.0.1"; $env:DB_PASS = "<password of aerosafe_user>"
uv run python -m services.historical.cli ..\..\data\prc2024 --area france-100km --from 2022-07-01 --to 2022-07-01 --dry-run
uv run python -m services.historical.cli ..\..\data\prc2024 --area france-100km --from 2022-07-01 --to 2022-07-01
```

`--delete-source` deletes each daily file once its points are verified in the database, to free the disk as the import goes (only the `.parquet` files, never `flight_list.csv` or the README). Keep a copy elsewhere first. Run `ANALYZE "OBSERVATION"` as the table owner after a large import.

### First measure: the day 2022-07-01

Loaded on 2026-11-12 into the PostgreSQL of `docker compose` (PostGIS 17, default settings), on the Windows development machine.

| Topic | Measure |
| --- | --- |
| Load | 3 740 123 points, 1 272 aircraft and 1 278 flights in 5 min 02 s, so **12 370 points a second**. The client side (DuckDB 3.1 s, batches to Python 4.4 s, keys 0.8 s) takes 8 s of the 302: the rest is the `INSERT` |
| Size | Table 530 MB and six indexes 605 MB, so **318 bytes a point** (my first estimate was 150). Indexes: position GiST 152 MB, unique pair 113 MB, (flight, position time) 113 MB, (flight, last contact) 113 MB, primary key 80 MB, last contact 36 MB |
| Journal | 2.9 GB of WAL written for 1.1 GB of data, 7 checkpoints forced by a full WAL (`max_wal_size` is 1 GB), none on the timer; `shared_buffers` is 128 MB, below the 605 MB of indexes |
| Year, France | 1.05 billion points at 318 bytes: **about 334 GB** with the rectangle. It fits on the development disk with `--delete-source`: the 306 GB of parquet are freed as the files are loaded, so the net need is about 28 GB. At 12 370 points a second (one connection), about 24 hours; see the measures below |
| Year, Île-de-France | 4.8 % of the points of France on this day (180 306 against 3.74 million), so about 16 GB |

Why it is not faster although no resource is at 100 % in the task manager: one `INSERT` runs in one PostgreSQL process, so on one core, and a saturated core is under 10 % of a processor with many threads. The disk is almost idle (about 10 MB/s). The time goes into the maintenance of six indexes and into the checkpoints, not into the client.

### Bulk-load settings and parallel inserts

Two levers tried on 2026-11-12, on the days 2022-07-02 and 2022-07-03 (about 4 million points each), against the 12 370 points a second of the first day.

| Try | Points a second | What changed |
| --- | --- | --- |
| PostgreSQL settings, one connection (`shared_buffers` 2 GB, `wal_buffers` 64 MB, `max_wal_size` 16 GB, `min_wal_size` 4 GB, `checkpoint_timeout` 30 min, `wal_compression` lz4) | 12 800 (13 000 to 13 400 while inserting) | **+5 %.** Checkpoints forced by a full WAL went from 7 to 0 and the WAL from 0.77 to 0.69 KB a point, so the checkpoints were not the bottleneck |
| Five insert workers (a commit per batch), container limited to 6 CPU | **24 600** (25 900 while inserting) | **×2.** 3 833 439 points in 2 min 36 s; the counts add up (11 604 727 observations for the three days, 3 829 aircraft, 3 839 flights) |

The parallel run is far from five times faster, so something else limits it. Not measured, so not claimed: the contention on the pages of the indexes that every worker writes to (the last contact time, the position GiST), or the WAL insertion lock. The settings above were applied to the development container only (`ALTER SYSTEM`), not to `docker-compose.yaml`.

Levers left:
- More workers (6) or larger batches: a small gain at best, to measure.
- Fewer or deferred indexes during the load. This changes the schema outside the migrations, so it needs a decision.
- A smaller selection: Île-de-France, or fewer days.

## Next steps

1. ~~Test d10 on one day~~ Done on 2022-07-01, see above. Remaining: check the `BL_AU_SOL` rule and the outlier limits on the first imported day, with R3 to R5.
2. Ask OpenSky where the d1 and d11 files went, together with V-01.
3. If the team keeps a historical mode, reopen D-05 in [open points](open-points.md), and record the source of each collection run (live or import) in a reference table, following the [database conventions](database-conventions.md). The import does not touch `EXECUTION_COLLECTE`.
