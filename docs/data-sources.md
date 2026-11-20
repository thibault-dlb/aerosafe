# Live data sources

AeroSafe collects live traffic from two sources **in parallel** (D-23, decided on 2026-11-20): the OpenSky Network, the source set by the project sheet (§4), and the adsb.fi open data API. Each user picks what they look at with the switch at the top of the application, **OpenSky | adsb.fi | Rejeu** (adsb.fi by default). The two sources are never mixed: each has its own aircraft, flights, observations, alerts and rule episodes, as the replayed traffic already has (`R_SOURCE_DONNEE`: `DIRECT` for OpenSky, `ADSBFI`, `REJEU`).

The terms, quotas and fields of OpenSky are in [OpenSky Network](opensky.md); this page compares the two sources and gives the terms of adsb.fi.

## Comparison

Measured on 2026-11-20 at about 11:30 UTC, OpenSky being read anonymously (time resolution 10 s; an account gets 5 s) and adsb.fi at the same instant, on the Île-de-France box of OpenSky unless stated otherwise.

| | OpenSky | adsb.fi |
| --- | --- | --- |
| Access | OAuth2 account of the group, 4 000 credits a day | No account; one request per second from an address |
| Area collected | The box of the profile: Île-de-France (48.0 to 49.3 N, 1.4 to 3.6 E), or metropolitan France | A circle of 250 NM (463 km) around 48.65 N, 2.5 E, the middle of the Île-de-France box: the largest the API serves. It reaches London, the Benelux and the Massif Central |
| Period | 30 s (120 s for France): the credits allow no faster | 5 s |
| Aircraft in the area | 58 in the box | About 700 to 760 in the circle; 42 in the box |
| Freshness | The answer was about 15 s older than the one of adsb.fi | Age of the positions at the time of the answer: 0.3 s median, 2.7 s at most |
| Times | Last contact and last position in whole seconds | Ages to 0.1 s (`seen`) and to the millisecond (`seen_pos`), counted back from the time of the answer. AeroSafe cuts them to the second, as OpenSky gives them. The same message can come back with an age 0.1 s different in the next answer |
| Position accuracy | Depends on the transponder; OpenSky does not give it | Given per aircraft (NACp): 9 to 11 in the box, that is an estimated error under 30 m, 10 m or 3 m |
| Altitude | Barometric altitude in metres, in steps of 25 ft (7.62 m) | The same steps, in feet, converted to metres; `ground` for an aircraft on the ground |
| Speed and heading | Metres per second and degrees | Knots (to 0.1 kt) and degrees (to 0.01°), converted |
| Aircraft on the ground | 16 of the 58 in the box | 1 of the 42: the airports are poorly covered |
| Aircraft in common | 41 of the 42 of adsb.fi | |
| Aircraft metadata | None in the collection | Registration, type code and description, which fill `AERONEF` and `R_MODELE` for the adsb.fi aircraft |
| Volume stored | About 45 aircraft every 30 s: about 130 000 observations and 40 MB a day | About 700 aircraft every 5 s: about 12 million observations and 3.8 GB a day (319 bytes an observation, indexes included), kept 7 days, so about 27 GB once steady |

In short: adsb.fi is fresher, more frequent and wider, and says how accurate each position is; OpenSky covers the ground of the airports better and is the source of the project sheet.

## Effect on the rules

- **Pairs of R3 to R5.** The rates compare the latest observation with the one of the same flight nearest to it and **at least 10 s back**, for both sources (the replay already did). At 5 s, the observation just before would be a pair the rates ignore ([business rules](business-rules.md#proposed-calculations)).
- **Altitude steps.** A step of 7.62 m over 10 s is ±0.76 m/s on R3, over 30 s ±0.25 m/s; the threshold is 30 m/s.
- **Times cut to the second.** Over a gap of 10 s, the cut changes the gap by up to 1 s, so a rate by up to 10 %; over 30 s, by 3 %.
- **Edge of the area.** An aircraft that leaves the area is no longer heard, and R1 would raise an alert after 300 s. The circle of adsb.fi has a long edge, so many aircraft leave it every hour. R1 and R2 therefore say nothing about an aircraft whose latest position is closer than 20 km to the edge of the area of its source (`RULES_EDGE_MARGIN_KM`), for both sources.
- **Aircraft left out of an answer.** adsb.fi only lists the aircraft heard in the last minute. R1 reads the stored observations, so it still sees an aircraft that went silent.

## How adsb.fi is read

- `GET https://opendata.adsb.fi/api/v3/lat/{lat}/lon/{lon}/dist/{nm}`, with a neutral `User-Agent` (`AeroSafe (educational project)`): nothing about the people who run the application.
- One request per cycle, and never two within a second, a manual run included.
- A `429` waits for its `Retry-After`, a minute without one. A `400`, `401`, `403` or `404` waits a minute too: adsb.fi counts refused requests against its limit, and too many of them block the address for a while. Any other failure marks the cycle as failed; the next one tries again.
- An address starting with `~` (not an ICAO address: TIS-B, anonymised) is rejected.
- An aircraft whose message counter (`messages`) has not moved since the previous answer sent nothing new: it is left out instead of being stored again.

## Terms of use of adsb.fi

Source: the README of the open data API ([github.com/adsbfi/opendata](https://github.com/adsbfi/opendata)), read on 2026-11-20.

| Topic | What the terms say | Consequence for AeroSafe |
| --- | --- | --- |
| Allowed use | Personal and non-commercial use only | AeroSafe is a non-commercial course project. "Personal" is read as allowing it: an assumption recorded in [open points](open-points.md) (V-04), as for the terms of OpenSky (V-01) |
| Resale | The data and the service may not be licensed, sold, rented or leased | Not applicable |
| Citation | adsb.fi must be cited, with a link to its home page | The footer of every page cites adsb.fi with a link to https://adsb.fi; so does this documentation |
| Warranty | Data and service are provided as is, and access can be suspended at any time | The collection copes with missing values and with the source being down (NF-04); OpenSky still runs in parallel |
| Limits | One request per second on the public endpoints; refused requests count against the limit | See [how adsb.fi is read](#how-adsbfi-is-read) |

As with OpenSky, the collected data is never committed (the repository is public) and is deleted with the database at the end of the project.

## Storage and retention

The observations of adsb.fi older than 7 days (`ADSBFI_RETENTION_DAYS`) are deleted every hour, by batches. It is the one physical deletion of the application, decided on 2026-11-20: a soft delete would keep the rows and their disk. The OpenSky observations and the replayed traffic are never touched. A week of adsb.fi is enough to tune and validate the optional AI module, which is trained on the replayed history (856 million points) and applied to the live traffic; see [data model](data-model.md#decisions-of-2026-11-06).

The settings of both sources are listed in [API](api.md#collection-apiv1collection) and [installation](installation.md#configuration).
