# Technology choices

Every technology chosen needs a written justification in the design documentation and is presented at the defence (§IV.2).

## Selection grid

Technical and organisational choices are judged against these weighted criteria. The grid is also used to settle points the specifications leave open: frontend framework, mapping library and CI tool.

| Criterion | Weight | What is assessed |
| --- | --- | --- |
| Functional fit | 25% | Coverage of BF-01 to BF-14, ability to handle geospatial data |
| Team skills | 20% | Existing skills, learning curve compatible with the deadlines |
| Stack integration | 15% | Compatibility with Python, FastAPI, PostgreSQL and Docker |
| Maturity and support | 15% | Stability, documentation, community activity, longevity |
| Cost and licence | 15% | Free of charge, open-source licence compatible with educational use |
| Portability and deployment | 10% | Ease of containerising and reproducing environments |

## Summary

| Topic | Choice | Status | Basis |
| --- | --- | --- | --- |
| Data source | OpenSky Network | Set | Specifications |
| Database | PostgreSQL | Set | Specifications |
| Backend / API | Python, FastAPI | Set | Specifications |
| Versioning | Git | Set | Specifications |
| Containers | Docker | Set | Specifications |
| Frontend | React, TypeScript | Decided on 2026-11-02 | See below |
| Python tests and linting | pytest, ruff | Decided on 2026-11-02 | No detailed assessment recorded |
| Mapping library | `TBD` | Open | Must be open source; use the grid |
| CI/CD tool | `TBD` | Open | Use the grid |
| AI library (bonus) | `TBD` | Open | Python machine learning library |

## Frontend: React with TypeScript

The options were compared qualitatively against the grid. No numeric score was calculated.

| Criterion | React + TypeScript | Angular | Vue.js + TypeScript | NiceGUI |
| --- | --- | --- | --- | --- |
| Functional fit | Map and dashboard possible | Map and dashboard possible | Map and dashboard possible | Possible, with less room for customisation |
| Team skills | At least one member already knows it | Not reported | Not reported | Not assessed |
| Stack integration | Consumes the FastAPI REST API | Consumes the FastAPI REST API | Consumes the FastAPI REST API | Built on FastAPI |
| Maturity and support | High, very large ecosystem | High | High | Lower, younger project |
| Cost and licence | Free, MIT | Free, MIT | Free, MIT | Free, MIT |
| Portability and deployment | Static build served by a web server | Static build served by a web server | Static build served by a web server | Python container |
| Object-oriented style (project rule) | Weak for components | Strong: classes and dependency injection | Weak for components | Good: Python classes |

**Why React:** it is the only option with reported team experience, and it is mature with a very large ecosystem.

**Trade-off:** React's recommended style relies on functions and hooks, which fits the object-oriented rule poorly. To apply that rule anyway:

- components are functions, as React recommends;
- everything outside components (models, services, API client) uses TypeScript classes.

## Mapping library

`TBD`. The specifications require an open-source library chosen with the grid.

## CI/CD tool

`TBD`. The repository is hosted on GitHub.
