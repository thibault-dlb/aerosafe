# Historical data

Exploration of the sources that could let AeroSafe run on past air traffic instead of the live OpenSky REST API, checked on 2026-11-09, then the import of one of them and the replay mode built on it. The replay mode was decided on 2026-11-13 (D-20 in [open points](open-points.md), which reopened D-05): see [Replay mode](#replay-mode). The exploration of the other sources is not a decision.

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

`scripts/verify_prc2024.py` reads every column of every row of the 365 files (about 306 GB, several minutes, one progress line a file, DuckDB limited to 6 threads) and keeps, for each file, its size, its number of rows and a checksum of all its values; `flight_list.csv` and the README get a SHA-256. `write` records them in `data/prc2024/MANIFEST.csv` on a folder known to be good, `check` compares a folder with that manifest, so a copy that lost or changed a byte is found. The manifest of the folder that was verified on 2026-11-12 (367 files, 306 474 493 017 bytes, 6 390 198 052 rows) is versioned, `scripts/prc2024-manifest.csv`, since it only holds sizes and checksums of a public dataset. A machine that already has the data only pulls the repository and runs `check` with it:

```powershell
uv run scripts/verify_prc2024.py write data/prc2024
uv run scripts/verify_prc2024.py check data/prc2024 --manifest scripts/prc2024-manifest.csv
```

`scripts/copy-prc2024.ps1 -Destination <folder>` copies the whole `data` folder (the files, `MANIFEST.csv` and anything else in it) with a live progress: files, GB, speed and time left. A file already at the destination with the same size is skipped, so a stopped copy is resumed by running it again, and nothing is ever deleted at the destination. At the end it compares every size; then run `check` on the copy.

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

The whole year was then loaded with `france-100km` (see the fourth measure): 855 808 655 points and 272 GB, so 318 bytes a point as estimated, in about 7 h 45 of inserts plus 31 min to rebuild the position index. The estimate of 9.7 h was too high because the position index was dropped during the load.

The import has no `--step` option yet: it keeps the resolution of the dataset. R3 to R5 ignore two points less than 10 s apart, so a step under 10 s would need the engine to compare a point with the one two or more steps before.

## Import into PostgreSQL

`src/api/services/historical` loads the daily files into `AERONEF`, `VOL` and `OBSERVATION`. Rules chosen for the replay (D-20, 2026-11-13; to confirm with the supervising teacher like the other team decisions): the area of metropolitan France, every trajectory (listed or not), clipped to the area, at the resolution of the dataset (one point per second, no downsampling), aircraft anonymous.

| Topic | Rule |
| --- | --- |
| Area | `--area france-100km`: metropolitan France without Corsica, plus 100 km all around, as a mask of cells of 0.01 degree (see below). Without it, a rectangle: `--bbox`, by default the `COLLECTION_BBOX_FRANCE` setting. The points outside are dropped, so an aircraft that leaves the area and comes back more than 30 minutes later makes a second flight |
| Aircraft | One `AERONEF` per flight of the dataset, since the obfuscated `icao24` is the `flight_id`. `CD_ICAO24` is the flight identifier minus 248 000 000, written in six hexadecimal digits (the identifiers go from 248 750 611 to 258 074 492, which fits in 24 bits). Registration, model and airline stay empty |
| Flights | One `VOL` per segment of trajectory, cut when two points are more than `COLLECTION_FLIGHT_GAP_MINUTES` apart (D-06). Callsign and airports stay empty |
| Observations | `DT_DERNIER_CONTACT` and `DT_POSITION` are the time of the point, so **R1 and R2 never fire**. Altitude ft to m, speed kt to m/s, heading rounded to 2 decimals with 360 turned into 0, coordinates rounded to 6 decimals |
| Outliers | An altitude outside −500 to 60 000 ft, a speed below 0 or above 700 kt, a heading outside 0 to 360 become empty and the point is kept, as the collector does with OpenSky: the rules skip a missing value |
| `BL_AU_SOL` | The dataset has no such field. True when the speed is under 40 kt and the altitude under 3 000 ft. A speed under 40 kt at a higher altitude is a glitch: the speed is emptied. A simplification to validate with R4, since a takeoff roll above 40 kt counts as airborne; ground points are only 0.05 % of the data |
| Source | Every imported aircraft takes the source `REJEU` (`AERONEF.ID_SOURCE_DONNEE`, reference table `R_SOURCE_DONNEE`), while the live collection keeps `DIRECT`. An ICAO24 address is unique for each source, so a synthetic code can equal the address of a real aircraft without any clash, and the import no longer refuses a database that holds live data |
| Parallelism | The aircraft and flights of a file are committed first, then the batches of 50 000 observations go through a queue to `--workers` tasks (default 6, no upper limit: choose it for the machine and keep the connections under PostgreSQL's `max_connections`), each with its own connection and one transaction per batch. DuckDB is limited to 2 threads for each file. `--parallel-files N` (default 1) imports N daily files at the same time, each with its own reader, its own `--workers` and its own progress line: the connections and the cores add up (files x workers). DuckDB reads in a thread, so a file is read while the others insert. Measured: N files with W workers are not faster than one file with N x W workers, see the third measure |
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

### Database loaded before the source existed

A database imported before the migrations 0035 to 0045 holds only replayed aircraft, which the migrations mark as `DIRECT` like every existing aircraft. Once migrated, and only if the database holds nothing but the dataset, mark them as replayed:

```powershell
docker exec aerosafe_postgres psql -U aerosafe_admin -d aerosafe_db -c "UPDATE \"AERONEF\" SET \"ID_SOURCE_DONNEE\" = (SELECT \"ID\" FROM \"R_SOURCE_DONNEE\" WHERE \"CD_SOURCE_DONNEE\" = 'REJEU')"
```

It touches `AERONEF` only (about 318 000 rows for the year), never `OBSERVATION`.

### Load a large selection

The procedure used for the whole year on 2026-11-12 and 13 (fourth measure). It is manual: the command line does not drop or rebuild an index itself. Two roles matter: `aerosafe_user`, the role of the application and of the import, can neither drop an index of `OBSERVATION` (the owner is `aerosafe_migrator`) nor change a server setting. The superuser `aerosafe_admin` does both.

1. **Drop the position index.** With it, the speed fell from 35 700 to 9 600 points a second over the first 95 million points (see the fourth measure). Without it, the speed stayed flat over the 757 million points that followed. The schema differs from the migrations until step 5, which recreates the index with the same name and definition as migration 0011. The application does not need the index meanwhile: its only spatial filter, `ST_Intersects` in `services/aircraft/service.py`, applies to a subquery of the latest positions, which this index cannot serve.
2. **Give PostgreSQL its memory**, and check it with `SHOW shared_buffers`. These settings only apply to the container where they are set, and `shared_buffers` was found back at 128 MB before the year, although it had been set to 2 GB for the second measure; the cause was not found.
3. **Restart cleanly.** `docker restart` gives PostgreSQL 10 seconds to stop. After a long load, its last checkpoint takes longer, so it is killed and replays its WAL at the next start: 15 minutes during the fourth measure, with the database closed. Run a `CHECKPOINT` first and give it time with `-t 600`.
4. **Run the import** with as many workers as PostgreSQL has CPU, and `--delete-source` if the disk is short (see the third measure).
5. **Rebuild the index and analyse the table** at the end. It takes one core and space for the sort, on top of the index itself (about 41 bytes a point).

```powershell
# 1 to 3, from any folder
docker exec aerosafe_postgres psql -U aerosafe_admin -d aerosafe_db -c 'DROP INDEX idx_observation_position' -c "ALTER SYSTEM SET shared_buffers = '2GB'" -c "ALTER SYSTEM SET wal_buffers = '64MB'" -c 'CHECKPOINT'
docker restart -t 600 aerosafe_postgres
docker exec aerosafe_postgres psql -U aerosafe_admin -d aerosafe_db -c 'SHOW shared_buffers' -c 'SHOW wal_buffers'

# 4, from src\api
docker update --cpus 9 aerosafe_postgres
uv run python -m services.historical.cli ..\..\data\prc2024 --area france-100km --workers 8 --delete-source

# 5
docker exec aerosafe_postgres psql -U aerosafe_admin -d aerosafe_db -c '\timing on' -c "SET maintenance_work_mem = '2GB'" -c 'CREATE INDEX idx_observation_position ON "OBSERVATION" USING gist ("GEO_POSITION")' -c 'ANALYZE "OBSERVATION"'
```

The disk of Docker Desktop (`%LOCALAPPDATA%\Docker\wsl\disk\docker_data.vhdx`) grows with the database and never gives space back to Windows by itself. The sort files of step 5 are deleted inside, but their space stays held by this file (about 22 GB for the year). Compacting it needs Docker Desktop and WSL stopped (`wsl --shutdown`), then `Optimize-VHD` as administrator; not done so far.

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
- More workers (the default is now 6, and there is no limit) or larger batches: a small gain at best, to measure. The measurement above used five workers.
- Fewer or deferred indexes during the load. Done by hand for the position index on the whole year, which the speed needed (see the fourth measure). Doing it in the command line, or for other indexes, still needs a decision, since the schema differs from the migrations until the index is rebuilt.
- A smaller selection: Île-de-France, or fewer days.

### Second measure: the day 2022-07-01 with `france-100km`

Loaded on 2026-11-12 into a new database, the first real run of the `france-100km` mask. Another machine than the first measures: AMD Ryzen 5 5500 (6 cores, 12 threads), 16 GB of memory, Docker Desktop with 8 GB. Limit of 10 threads out of 12: 6 insert workers, PostgreSQL limited to 4 CPU (`docker update --cpus 4`), PostgreSQL default settings.

| Topic | Measure |
| --- | --- |
| Selection | 3 078 038 points (82.3 % of the 3 740 123 of the rectangle, as the dry run said), 1 126 aircraft, 1 130 flights. The dry run took 4 s |
| Load | 2 min 00 s, so **25 627 points a second** (24 600 on the first machine with 5 workers and 6 CPU for PostgreSQL: +4 %, which is not a gain beyond the noise, since the machines differ) |
| Size | `pg_total_relation_size('"OBSERVATION"')` is 981 917 696 bytes, so **319 bytes a point** (318 measured before): table 458 MB (149 bytes) and six indexes 524 MB (170 bytes). Indexes: position GiST 126 MB, flight 93 MB, flight and last contact 93 MB, unique pair 93 MB, primary key 66 MB, last contact 29 MB |
| Counts | 3 078 038 observations, 1 126 aircraft and 1 130 flights, as in the file |

Consequence for the year with `france-100km`: 856 million points at 319 bytes make about **273 GB**, and at 25 627 points a second at least **9.3 h** (a lower bound: the indexes slow the inserts as they grow). Not measured: how the speed evolves over many days, and the peak size of the WAL.

### Third measure: workers, files at the same time and CPU of PostgreSQL

Measured on 2026-11-12 on the Ryzen 5 5500 (12 threads), with `scripts/bench-import-workers.ps1`: the same 3 days (2022-07-01 to 07-03, 9 530 758 points with `france-100km`) loaded from an empty database for each config, 11 threads at most (the client plus the CPU given to PostgreSQL with `docker update --cpus`). Speed is that of the whole command.

| Files at a time | Workers each | CPU of PostgreSQL | Points a second | Points a second and per CPU of PostgreSQL |
| --- | --- | --- | --- | --- |
| 1 | 5 | 6 | **31 526** | 5 254 |
| 3 | 2 | 5 | 29 899 | 5 980 |
| 1 | 6 | 5 | 28 729 | 5 746 |
| 2 | 3 | 5 | 28 383 | 5 677 |
| 2 | 4 | 3 | 18 908 | 6 303 |
| 1 | 8 | 3 | 16 115 | 5 372 |
| 3 | 3 | 2 | 10 799 | 5 400 |
| 1 | 2 | 9 | 19 050 | 2 117 |
| 1 | 8 | 9 | **36 856** | 4 095 |

The last two rows were measured afterwards, on 2022-07-01 only (3 078 038 points in 2 min 42 s with 2 workers, in 1 min 24 s with 8). On the same day, 5 workers on 6 CPU took 1 min 34 s (32 860 points a second): going to 8 workers and 9 CPU gains 12 % only, against 50 % more CPU. The speed for each CPU falls (5 254, then 4 095), so beyond about 6 CPU something shared limits the inserts; not measured, probably the contention on the indexes. At 36 856 points a second the year with `france-100km` takes at least 6.5 h (856 million points, a lower bound).

- **The speed is limited by the smaller of the workers and the CPU of PostgreSQL**: each worker is one PostgreSQL process, so about one core. When the workers are at least as many as the CPU, the speed is about 5 300 to 6 300 points a second for each CPU, in proportion with 2, 3, 5 and 6 CPU. With only 2 workers on 9 CPU, seven CPU stay idle and the speed is 19 050 points a second, 9 500 for each worker.
- **Several files at the same time do not help**: at equal CPU, 3 x 2 workers (29 899) is 4 % above 1 x 6 (28 729) and 2 x 3 (28 383) is 1 % under it, which is within the noise of a single run; 2 x 4 is 17 % above 1 x 8 on 3 CPU, again a single run. In the 2 x 4 run, the third file, alone, went at 20 953 points a second, more than the two together (17 500).
- **More workers than CPU do not help**: 8 workers on 3 CPU are not faster than 4 workers on 3 CPU.
- **Not measured**: the CPU used by the client. The workers are tasks of one Python process, so the client probably needs only one or two cores, which would let PostgreSQL have 8 or 9 CPU with as many workers. My first guess, that 2 to 4 workers on 7 to 9 CPU would reach about 40 000 points a second, was wrong (see the last row, 8 workers on 9 CPU).
- **Year with `france-100km`**: 856 million points at 31 526 points a second make at least **7.5 h** (a lower bound, the indexes slow the inserts as they grow), against 9.3 h at the speed of the second measure.

### Fourth measure: the whole year with `france-100km`

Loaded from 2026-11-12 to 2026-11-13 on the Ryzen 5 5500, in the PostgreSQL of `docker compose` (PostgreSQL 17.11, PostGIS), with 8 insert workers, PostgreSQL on 9 CPU (`docker update --cpus 9`) and `--delete-source`. Docker Desktop has 7.8 GB of memory, half of the 15.8 GB of the machine.

**First run, with the six indexes.** The speed fell as the table grew: 35 737 points a second on the first file, 17 700 to 27 200 on files 20 to 30, 9 600 to 14 700 on files 55 to 65. The run was stopped after 67 files (2022-01-01 to 2022-03-08, about 1 h 30). What PostgreSQL showed at 95 million points:

| Topic | Measure |
| --- | --- |
| Size | Table 13 GB, indexes 15.6 GB, of which the position GiST 3.8 GB |
| Reads outside `shared_buffers` | Position GiST **31 163 174 blocks**, last contact 1 144 868, the four other indexes under 440 000 together |
| Settings | `shared_buffers` 128 MB (not the 2 GB of the bulk-load try), so `wal_buffers` 4 MB |
| WAL, over one minute | 1.15 GB and 144 870 full-page images for 792 637 points, so 1.5 KB a point (0.69 KB on three days) |
| Waits of the insert workers | `WALWrite` and `BufferContent` |

The B-tree indexes take each new row at their right end, since their keys grow with the import (the row key, the aircraft and flight keys, the time within a day), so only their last pages are written. The GiST puts a point where its position is, so the inserts touch pages all over the index. Once the index is larger than the memory, each insert reads pages back. After each checkpoint, the first change of a page writes the whole page into the WAL, so the WAL grows too. The GiST then grows with the table, up to 35 GB for the year, more than four times the memory of Docker Desktop, so the speed would have kept falling.

**Second run, without the position index**, with `shared_buffers` 2 GB and `wal_buffers` 64 MB, following [Load a large selection](#load-a-large-selection). The restart before it was not clean (see step 3 there): 907 s of recovery.

| Topic | Measure |
| --- | --- |
| Load | 298 files (2022-03-09 to 2022-12-31) in 6 h 14 min: 757 587 630 points inserted, so **33 760 points a second** over the run |
| Speed along the run | 31 000 to 40 000 points a second a file on the first 14 files, 33 000 to 37 600 on the last 20: **no decline** |
| Slowdowns | Seven stretches at 21 000 to 30 000 points a second, around files 15, 53, 77, 105, 142, 185 and 253, further and further apart. PostgreSQL ran 8 autovacuums of `OBSERVATION` during the run, and an insert-only table is vacuumed each time it grows by 20 % (`autovacuum_vacuum_insert_scale_factor`), which matches the growing gaps. Probable cause, times not matched one by one |
| Files already loaded | 2022-07-01, left by the earlier measures, was recognised as complete in 5 s and deleted |

The counts add up: the final line reports 760 665 668 points, which counts the 3 078 038 points of 2022-07-01 already in the database, and the table went from 98 221 025 to 855 808 655 rows, so 757 587 630 more. 2022-03-09, the file the stop interrupted, had nothing committed and was loaded in full.

**Rebuilding the position index**: 30 min 46 s on one core (the scan of the table took about 7 min, estimated from its progress, then the sort and the writing), and 3.4 s for `ANALYZE`. Sort files reached 7.2 GB at a third of the scan; their peak was not measured. A search on a rectangle around Paris uses the index (`Index Scan using idx_observation_position`).

**Result**, measured with `pg_relation_size` (`pg_size_pretty` writes the total 253 GB, since it counts in units of 1 024):

| Object | Bytes | Bytes a point |
| --- | --- | --- |
| `OBSERVATION`, table | 127 393 767 424 | 148.9 |
| Position GiST | 35 411 771 392 | 41.4 |
| (flight, position time) | 27 168 702 464 | 31.7 |
| (flight, last contact) | 27 168 718 848 | 31.7 |
| (aircraft, last contact), unique | 27 158 626 304 | 31.7 |
| Primary key | 19 229 401 088 | 22.5 |
| Last contact | 8 550 424 576 | 10.0 |
| **Total** | **272 116 260 864** | **318.0** |

855 808 655 observations from 2022-01-01 03:30:38 to 2022-12-31 23:59:59 UTC, 318 277 aircraft and 318 623 flights. The size per point is the one of the first day, so the estimates above hold.

**Disk C:**, in units of 1 024 as Windows counts: 63.9 GB free when the second run started, 85.5 GB after a cleanup outside the project, 142.7 GB at the end of the import (250 GB of parquet deleted, 195 GB more in the database), 86.9 GB after the index: the disk of Docker Desktop went from 243.9 to 299.3 GB, for an index of 33 GB in these units, so about 22 GB stay held by the deleted sort files.

**Total time**: about 7 h 45 of inserts over the two runs, 15 min of recovery and 31 min of index.

## Replay mode

Decided on 2026-11-13 (D-20). The imported traffic can be replayed like a live collection: a simulated clock moves through the dataset, the pages show the traffic and the alerts at that instant, and the rules engine runs as the clock goes by. The target is the whole year 2022 over France and 100 km (856 million observations, about 272 GB, about 318 000 aircraft and flights). The tests are made on one month, August 2022.

| Topic | Rule |
| --- | --- |
| Source of the data | Every aircraft has a source, `DIRECT` for the live collection and `REJEU` for the import (`R_SOURCE_DONNEE`, `AERONEF.ID_SOURCE_DONNEE`). An ICAO24 address is unique for each source. The import and the replay only touch the aircraft of their source, so one database can hold live data and the replay together |
| Clock | One shared clock, in `PARAMETRE_REJEU`: a Supervisor starts it at an instant of the period, pauses and resumes it, and picks the speed (×1, ×10, ×60). The simulated time is the instant stored at the last change plus the real time gone by times the speed, so nothing is written while it runs. It stops at the end of the data. See [API](api.md#replay-apireplay) |
| Rules | A scheduler reads the clock every 10 s and runs the engine for each 30 s step of simulated time that went by, in the same transaction as the note of the last step evaluated. R3 to R5 run on the replayed traffic. **R1 and R2 are left out**: the dataset has no contact time apart from the position time, so a delay since the last message is always zero. At one point a second, R3 to R5 compare a point with the nearest one at least 10 s back, because they ignore closer pairs. An aircraft counts as present when it sent a point in the minute before the instant |
| Starting again | Starting at another instant removes (logically) the alerts of the earlier run that are dated at or after it, so the clock does not create them a second time, and ends the open episodes |
| Interface | A Live / Replay switch in the top bar, kept in the browser. The replay bar shows the simulated time in UTC and the controls; only a Supervisor can use them. The page loads again when the mode changes. The home page shows metropolitan France and refreshes every 5 s |
| What is shown | At the simulated instant: the aircraft heard in the minute before it with their position then, the observations, flights and trajectories up to it, the alerts triggered up to it, and the statistics of the 24 hours before it |

### Sizing for the whole year

The design avoids anything that grows with the table of observations:

- no migration rewrites `OBSERVATION` and none adds an index to it (an index takes about 30 minutes and 27 GB or more on the year);
- the aircraft present at an instant are read from a range of the index on `DT_DERNIER_CONTACT`: about a minute of data, a few thousand rows, whatever the size of the table;
- the latest position of an aircraft is read through the unique index (`ID_AERONEF`, `DT_DERNIER_CONTACT`), one LATERAL subquery for each aircraft, so the search no longer sorts the whole table (the DISTINCT ON it replaced would have read every observation);
- the period of the data is read from `VOL` (about 318 000 rows), not from `OBSERVATION`, and kept for a few minutes.

## Next steps

1. ~~Test d10 on one day~~ Done on 2022-07-01, see above. Remaining: check the `BL_AU_SOL` rule and the outlier limits on the first imported day, with R3 to R5.
2. Ask OpenSky where the d1 and d11 files went, together with V-01.
3. ~~Reopen D-05 and record the source~~ Done on 2026-11-13 (D-20): the source is recorded for each aircraft, in `R_SOURCE_DONNEE`. The import does not touch `EXECUTION_COLLECTE`.
4. Decide whether the command line should drop and rebuild the position index itself for a large import (an option, run as a role that owns the table), and whether the bulk-load settings belong in `docker-compose.yaml` rather than in one container.
