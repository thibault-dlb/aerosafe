# OpenSky Network

Terms of use and access conditions of the data source. The project sheet sets the OpenSky Network as the data source (§4) but says nothing about its terms. Checking them is V-01 in [open points](open-points.md), from specifications §V.1, §VII.1 and §VII.3. Quotas and collection profiles are also summarised in [architecture](architecture.md#data-source).

Checked on 2026-11-06 from two official pages:

- the [General Terms of Use and Data License Agreement](https://opensky-network.org/about/terms-of-use);
- the [REST API documentation](https://openskynetwork.github.io/opensky-api/rest.html).

These terms can change: OpenSky announces changes by email to the account holder, and they apply 15 days later (§2 iii).

## Terms of use

Source: General Terms of Use and Data License Agreement.

| Topic | What the terms say | Consequence for AeroSafe |
| --- | --- | --- |
| Allowed use | The data may be used only for non-profit research and non-profit education (§1) | Allowed: AeroSafe is an educational project at IPSA, with no commercial use |
| Commercial use | Any use by a for-profit or commercial entity needs a written licence (§1) | Not applicable |
| Operational use of the REST API | Using the REST API "in any operational capacity", including an automated system, needs a written licence, even for a non-profit (§1, §3 vi) | **To confirm (V-01).** AeroSafe collects automatically, but only for a course project that is never used operationally. Ask the supervising teacher, and OpenSky (contact[at]opensky-network.org) if in doubt |
| Accounts | Several accounts must not be registered, in particular to get more API credits (§3 v) | One account for the group (see [collection](#collection)) |
| Redistribution | The data must not be made available to anyone outside the people working on the project (§3 iii) | The repository is public since 2026-11-09 ([project terms](project-terms.md)), so collected data, database dumps and seed files built from real observations are never committed. Test data is synthetic |
| Privacy | In any publication, personally identifiable information and aircraft identifiers must be anonymised (§3 i) | Public material (a public page, slides shared outside the course) shows anonymised aircraft |
| Citation | Any publication using the data, including web pages and public presentations, must cite the paper below and be sent or linked to OpenSky (§4 i) | Cited in the deliverables and in the application |
| End of project | All copies of the data must be deleted once the work is over, with a reasonable delay (§4 ii) | The database and any data export are deleted after the defence |
| Warranty | The data is provided "as is", with no guarantee of accuracy, completeness or availability (§5 iv) | AeroSafe must cope with missing or wrong values and with the source being down (NF-04) |

Citation required by §4 i:

> Matthias Schäfer, Martin Strohmeier, Vincent Lenders, Ivan Martinovic, Matthias Wilhelm. *Bringing up OpenSky: A large-scale ADS-B sensor network for research.* ACM/IEEE International Conference on Information Processing in Sensor Networks, April 2014.

The website can be credited as well: "The OpenSky Network, https://opensky-network.org".

## Access

Source: REST API documentation.

| Access type | Credits per day | Time resolution |
| --- | --- | --- |
| Anonymous (no account) | 400 | 10 s |
| OpenSky account (API client) | 4 000 | 5 s |
| Active feeder (own ADS-B receiver) | 8 000 | 5 s; not applicable to AeroSafe |

- **Authentication.** OpenSky only accepts the OAuth2 client credentials flow; username and password are no longer accepted. An API client is created on the OpenSky account page, and its client ID and secret are exchanged for a token. The token expires after 30 minutes and must be renewed (a `401` means it has expired). The client ID and secret are secrets: they go in the `.env` file, never in Git ([contributing](../CONTRIBUTING.md)).
- **Rate limit.** When credits run out, OpenSky answers `429 Too Many Requests`. The header `X-Rate-Limit-Retry-After-Seconds` gives the wait in seconds, and `X-Rate-Limit-Remaining` the credits left.
- **History.** An account can query state vectors up to one hour back, anonymous access only the latest ones. AeroSafe does not use this: collection is live only ([architecture](architecture.md#data-source)).

### Credit cost

A call to `/api/states/all` costs credits depending on the area requested (bounding box, in square degrees: latitude range × longitude range).

| Area | Credits per call |
| --- | --- |
| Up to 25 sq° | 1 |
| 25 to 100 sq° | 2 |
| 100 to 400 sq° | 3 |
| Over 400 sq°, or the whole world | 4 |

## Fields used by the rules

Each state vector gives, among others, the fields below. They map to the `Observation` class of the [class diagram](uml/class-diagram.md) and are used by the [business rules](business-rules.md).

| OpenSky field | `Observation` attribute | Meaning | Unit |
| --- | --- | --- | --- |
| `time_position` | `positionAt` | Time of the last position update; empty if no position was received in the last 15 s | Unix seconds |
| `last_contact` | `lastContactAt` | Time of the last valid message of any kind | Unix seconds |
| `baro_altitude`, `geo_altitude` | `altitude` | Barometric and geometric altitude | m |
| `velocity` | `speed` | Speed over ground | m/s |
| `true_track` | `heading` | Heading, clockwise from north (0°) | ° |
| `on_ground` | `onGround` | True if the position comes from a surface position report | Boolean |

Both times must be stored: R1 uses `lastContactAt` and R2 `positionAt`. The rules also use `onGround` to ignore aircraft on the ground. Which altitude (barometric or geometric) feeds `altitude` is `TBD`.

## Collection

The two collection profiles (Île-de-France every 30 s, metropolitan France every 120 s) are set in [architecture](architecture.md#data-source) (D-05). The terms add these constraints, a team proposal to validate:

- **One** OpenSky account for the group, since the terms forbid several accounts. Its client ID and secret are shared only through each member's `.env` file.
- **Only one instance collects with the group account at a time**, for example the demonstration machine. The high frequency profile uses 2 880 credits per day, so two instances at once would need 5 760 and exceed the 4 000 of the account.
- Members developing locally use anonymous access (400 credits, about 3 hours at one call every 30 s) or a demo dataset kept out of any public repository.
- Everything collected is stored in PostgreSQL, so the demonstration still works when OpenSky is down (NF-04).
