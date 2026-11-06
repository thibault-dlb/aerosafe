# Database conventions

Source: the database guide `bible_bdd_final.pdf` (20 pages, in French). The PDF is kept locally in `docs/reference/` and is not versioned (it is listed in `.gitignore`). The rules below follow it without softening or reinterpreting it. Page numbers refer to the PDF.

These rules apply to every table, column, key, index, migration and query of the project. Where the guide contradicts itself or the project rules, the point is listed in [Points to settle](#points-to-settle) and in [open points](open-points.md); nothing is decided silently.

## 1. Table naming (p. 3)

All business and reference table names are in **UPPERCASE, in French, in the singular**.

| Type | Prefix | Content | Examples |
| --- | --- | --- | --- |
| Legacy | none | Tables created and managed by the framework (`users`, `jobs`, `queues`, `sessions`, ...). **Never modified.** | `users` |
| Business (métier) | none | Data created and modified by the application. Uppercase, French, singular | `AFFECTATION`, `MISSION` |
| Reference (référentielle) | `R_` | Stable data, rarely modified by the application, often shared between applications; serves as a reference list | `R_GRADE`, `R_SEXE` |
| Work (travail) | `W_` | Intermediate data in a non-final state, not to be used as is: temporary calculation or import tables to reprocess | `W_IMPORT`, `W_RESULTAT` |

## 2. Column naming (p. 4)

Each column carries a prefix that tells its data type. `ID` is the only type without an extra suffix.

| Prefix | Name | Meaning | Examples |
| --- | --- | --- | --- |
| `ID` | Identifier | Primary key: unique, not null, auto-incremented | `ID` |
| `CD_` | Code | Unique reference value, not necessarily readable by a human, on which business logic relies (employee number, serial number, social security number) | `CD_EMPLOYE`, `CD_COMMANDE`, `CD_SECURITE_SOCIALE` |
| `LB_` | Label | Text representing a title, a name or a label. Not necessarily unique | `LB_NOM`, `LB_PRENOM` |
| `DT_` | Date | Any date or timestamp: start, end, birth, licence obtained, whatever | `DT_DEBUT`, `DT_FIN`, `DT_NAISSANCE`, `DT_OBTENTION` |
| `NB_` | Number | Any figure or number: integer, decimal, signed, percentage; anything that is computed | `NB_LIT`, `NB_QUANTITE_DISPONIBLE` |
| `LN_` | Link | Text with an action semantic: email (opens the mailbox), social network profile, path to an image on the server | `LN_EMAIL`, `LN_INSTAGRAM`, `LN_IMG_SRC` |
| `BL_` | Boolean | Exhaustive, non-evolving list of 3 values or fewer. Usually two choices (yes/no), sometimes three (yes/no/not applicable) | `BL_ACTIF` (1/0), `BL_OCCUPE` (OUI/NON/N.A.) |
| `GEO_` | Geometry | PostGIS geometry. **Project extension, not in the guide** (decided on 2026-11-06) | `GEO_POSITION` |

A foreign key is named `ID_<TABLE>`, without the `R_` prefix. When a table references the same table twice, a suffix gives each column its role: `ID_AEROPORT_ORIGINE`, `ID_AEROPORT_DESTINATION`. This is a **project extension, not in the guide** (decided on 2026-11-06).

Why: without a prefix a developer can write `total * taux` without knowing whether `total` is a number or a label. With `NB_TOTAL * NB_TAUX` the error is visible before running the query.

## 3. Primary keys (p. 5)

Every table has a primary key.

| Criterion | IDENTITY | UUID | ULID |
| --- | --- | --- | --- |
| INSERT performance | Very fast | Slower | Fast |
| Size | 8 bytes | 16 bytes (`uuid`) | 26 bytes |
| Guessable | Yes (predictable) | No (opaque) | No (opaque) |
| Sortable | Yes | No | Yes |
| Microservices | Conflicts | Yes | Yes |

- `BIGINT IDENTITY` by default.
- ULID if the IDs appear in public URLs. UUID if several systems generate IDs without a central database (microservices, offline sync, import/export between databases); otherwise it slows the indexes down for nothing.
- Internal identifier: `BIGINT`. Visible identifier: `ULID`.
- The auto-generated technical key is used for joins. The **business key** has a meaning in the real world (employee number, SIRET, INSEE code) and must always carry a `UNIQUE` constraint, otherwise nothing prevents duplicates.
- On pure link tables (many-to-many), use a **composite key**: the primary key is the combination of the two foreign keys, with no superfluous `BIGINT`.

```sql
ID       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
CD_MATR  TEXT   NOT NULL UNIQUE  -- business / functional key

-- Link table: composite key (no BIGINT)
PRIMARY KEY (ID_PERSONNEL, ID_MISSION)
```

## 4. Normalisation (p. 6)

The third normal form (3NF) is the minimum.

1. **1NF, atomicity.** Each cell holds a single indivisible value. Never lists, arrays or comma-separated values (forbidden: `users(id, name, phones)` with `phones = "0601,0602,0603"`; correct: `users(id, name)` and `user_phones(id, user_id, phone)`).
2. **2NF, full dependency on the key.** Each column depends on the whole primary key, not on part of it (mostly for composite keys). Forbidden: `order_items(order_id, product_id, quantity, product_name)`. Correct: `order_items(order_id, product_id, quantity)` and `products(id, name)`.
3. **3NF, no transitive dependency.** No non-key column may depend on another non-key column; `zip_code → city → country` is a warning sign. Forbidden: `users(id, name, zip_code, city, country)`. Correct: `users(id, name, zip_code_id)`, `zip_codes(id, code, city_id)`, `cities(id, name, country_id)`.

## 5. Data types (p. 7)

Principle: choose the smallest type that covers the need.

| Need | Recommended | To avoid |
| --- | --- | --- |
| Sequential identifier | `BIGINT` + IDENTITY | `INTEGER` (limit of 2 billion) |
| Random identifier | `UUID` (native) | `VARCHAR(36)` (4 times heavier) |
| Financial amount | `NUMERIC(10,2)` | `REAL`, `DOUBLE PRECISION` (imprecise) |
| Text of any length | `TEXT` | `VARCHAR(n)` without reason (same performance) |
| Boolean | `BOOLEAN` | `CHAR(1)` with 'Y'/'N' |
| Date only | `DATE` | `TIMESTAMP` (useless) |
| Date and time | `TIMESTAMPTZ` | `TIMESTAMP` without time zone (ambiguous) |
| Flexible structure | `JSONB` (indexable) | `JSON` (text, not indexable) or `TEXT` |
| Small fixed set | **Reference table (always)** | `ENUM` (rigid, see §11 of the guide) |
| Binary file | Path to external storage | `BYTEA` in production |

- Never `REAL` or `DOUBLE` for money (`0.1 + 0.2 = 0.30000000000000004` in floating point). Always `NUMERIC(p,s)` for amounts.
- **Always a reference table, never an ENUM**, even for three values: a fourth value, a label to correct, a display order, a colour or a deactivation always comes. With a table it is an `INSERT`; with an `ENUM` it is a blocking `ALTER TYPE` migration coordinated on every environment. The guide's example: `post_statuses(id, code, label, description, sort_order, is_active)`.

## 6. Foreign keys and integrity (p. 8)

Referential integrity guarantees that a foreign key never points to a missing row.

| ON DELETE strategy | Behaviour | When to use |
| --- | --- | --- |
| `RESTRICT` | Blocks the deletion if children exist | Safe default, **use by default** |
| `CASCADE` | Also deletes all child rows in a chain | Truly dependent entities only, risk of massive loss |
| `SET NULL` | Sets the foreign key to NULL on the children | Optional relation (document without author) |
| `NO ACTION` | Like RESTRICT, check deferred | With `DEFERRABLE` only |

Never delete physically. Two strategies:

- **Soft delete, business tables:** `MISSION(ID, LB_NOM, DT_SUPPRESSION NULL)`. The row stays in the database for history, filtered by `WHERE DT_SUPPRESSION IS NULL`. We know who deleted and when.
- **Deactivation, reference tables:** `R_GRADE(ID, CD_GRADE, LB_GRADE, BL_ACTIF)`. The grade `EV1` is abolished but referenced everywhere; `BL_ACTIF = 0` hides it from input lists without breaking history.

Trap: PostgreSQL still sees soft-deleted rows, so a foreign key can point to a "deleted" parent without error. Always filter through a view or `WHERE DT_SUPPRESSION IS NULL`.

## 7. Indexes (p. 9)

Create an index when:

- the column is used in `WHERE`, `JOIN ON` or `ORDER BY`;
- the cardinality is high (many distinct values);
- the column is a foreign key (never auto-indexed).

Avoid an index when the table is small (under 1,000 rows), the column is written very frequently, or the cardinality is low (a boolean that is 95% true).

**Foreign keys do not create an index automatically.** PostgreSQL creates an index on the primary key and on `UNIQUE`, but not on foreign key columns. Always add it by hand, otherwise joins and `ON DELETE` checks explode in cost.

**Leftmost column rule (advanced).** A composite index on `(A, B, C)` is only used if the query filters on A, or A+B, or A+B+C. Never on B or C alone.

```sql
CREATE INDEX idx_orders_user_status
  ON orders(user_id, status, created_at);
-- usable: WHERE user_id = ?
--         WHERE user_id = ? AND status = ?
--         WHERE user_id = ? AND status = ? ORDER BY created_at
-- unusable: WHERE status = ?        (A missing)
--           WHERE created_at > ?    (A and B missing)
```

## 8. Timestamps and audit (p. 10)

Standard columns of every business table:

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
deleted_at TIMESTAMPTZ NULL  -- soft delete
```

`TIMESTAMPTZ` stores in UTC and converts to the client's time zone; `TIMESTAMP` (without time zone) ignores it and causes bugs as soon as a server changes time zone. For `updated_at`, use a `BEFORE UPDATE` trigger that does `NEW.updated_at = now()`.

For sensitive data (financial, medical, legal), keep the full history of every modification (advanced):

```sql
CREATE TABLE audit_actions (
  id    SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code  TEXT UNIQUE NOT NULL,  -- 'create', 'update', 'delete'
  label TEXT NOT NULL
);

CREATE TABLE audit_logs (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name TEXT        NOT NULL,
  record_id  BIGINT      NOT NULL,
  action_id  SMALLINT    NOT NULL REFERENCES audit_actions(id),
  old_values JSONB       NULL,
  new_values JSONB       NULL,
  user_id    BIGINT      NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_table_record ON audit_logs(table_name, record_id);
```

## 9. Migrations (p. 11)

A migration is a versioned script that changes the database structure. It must be reproducible, reversible and safe in production.

1. **One migration = one change.** Do not mix adding a table, changing a column and seeding in the same migration.
2. **Always write the `down`.** It allows rollback, even if rarely used.
3. **No business logic.** No complex calculations, no API calls: a migration manipulates structure.
4. **Immutable once merged.** Never modify a migration already deployed; create a new one.

`NOT NULL` trap in production: `ALTER TABLE orders ADD COLUMN notes TEXT NOT NULL;` locks the whole table. Safe: `ADD COLUMN notes TEXT NULL DEFAULT NULL;`, then backfill, then `NOT NULL`.

Renaming a column without downtime, in five steps:

1. add the new column (nullable);
2. deploy the code that writes to both;
3. migrate the existing data;
4. deploy the code that no longer reads the old one;
5. drop the old column.

## 10. SQL performance (p. 12)

1. `SELECT *` is forbidden; list the columns explicitly.
2. No large `OFFSET`; use keyset pagination (`WHERE id > 100000 ORDER BY id LIMIT 20`).
3. No N+1: one `JOIN` instead of one query per row.
4. **Transactions, all or nothing.** Every multi-table operation is wrapped in `BEGIN` / `COMMIT` (or `ROLLBACK` on error), so that no inconsistent intermediate state remains if a step fails.

## 11. Security (p. 13)

- **SQL injection.** Never build SQL by string concatenation, even in raw queries. Always use bound parameters.
- **Least privilege.** The application account only has `SELECT, INSERT, UPDATE, DELETE` on the tables of the schema. `DROP`, `ALTER`, `CREATE` are reserved for the migration account, never given to the application.
- **Passwords:** bcrypt or argon2 only. Never MD5/SHA1, never in clear.
- **PII (GDPR):** emails, phone numbers, addresses. Consider column-level encryption in a regulated context.
- **API tokens:** store the hash, not the token.
- **Backups:** encrypt them.

## 12. Data longevity (p. 14)

Data outlives the code that wrote it. Retention periods in France given by the guide: defence 50 years (classified archives), health 20 years after the last care, finance 10 years (accounting documents), HR 5 years after departure.

1. **ISO standard types only:** `TIMESTAMPTZ`, `NUMERIC`, `TEXT` in UTF-8. Avoid proprietary types so that a DBMS migration remains possible.
2. **Always a reference table**, never an `ENUM`: a table with a stable `code`, a mutable `label` and `is_active`.
3. **Append-only, immutable audit:** `audit_logs` only accepts `INSERT`. No `UPDATE`, no `DELETE`, even for a "correction". A rewritten proof is no longer a proof.
4. **Retention over deletion:** never a physical `DELETE` on business data. `deleted_at`, then archiving in a cold table. The GDPR right to be forgotten is handled by pseudonymisation, not deletion.

Golden rule: "if I have to read this data again in 10 years without documentation, will it be intelligible?"

## 13. Performance that lasts (p. 15)

| Anti-pattern | Why it breaks | Solution |
| --- | --- | --- |
| `LIKE '%xxx%'` | Systematic full scan, the B-tree index is useless | `GIN` index + `pg_trgm`, or a dedicated engine (Meilisearch, ES) |
| Exact `COUNT(*)` | Full scan on each call | Denormalised counter or estimate (`pg_class.reltuples`) |
| Large `OFFSET` | PostgreSQL reads then discards N rows | Keyset pagination (`WHERE id > last_id`) |
| `IN (10k values)` | Parser saturated, planner cannot optimise | `= ANY(ARRAY[...])` or temporary table + `JOIN` |
| `ORDER BY` outside an index | Sort in memory (`work_mem`) or on disk | Index covering the sort clause |

Before each production release, read four `EXPLAIN` columns: the access node (good: `Index Scan`, `Index Only Scan`; forbidden: `Seq Scan` on a large table), estimated `rows` (close to actual rows; a gap of x100 means stale statistics, run `ANALYZE`), `BUFFERS` (few `read`, mostly `hit`) and costly operations (`Sort Disk`, `Hash Disk`, massive `Nested Loop` are forbidden).

At large scale, precompute and do not recount.

## 14. Documentation (p. 16)

- **Every table has a `COMMENT ON TABLE` in French** describing its role, and **every column a `COMMENT ON COLUMN` in French, with no exception.**
- For each business table, answer: who **creates** (user, automatic job, external API; which role; through which form or flow), who **modifies** (under which conditions; which columns stay frozen once created), who **deletes** (physical or logical; which archiving policy) and what **cardinality** (hundreds, millions, billions: it drives index and partitioning choices).

## 15. Traces, geometry and drawings (p. 17 and 18)

The deciding question: "Will I ever query this data to find out **where**?"

- **No** (it is displayed, that is all) → `JSONB`. The drawing fits in one row, read and written in a single query, no join.
- **Yes** ("what is within 500 m?", "which zones overlap?") → **PostGIS**: `CREATE EXTENSION postgis;` with `GEOMETRY(LINESTRING, 4326)` for a series of GPS points and `GEOMETRY(POLYGON, 4326)` for a closed outline. `4326` is the world code of GPS coordinates (latitude/longitude).

Three reflexes for traces with thousands of points: simplify before sending (a mouse trace of 5,000 points can be reduced to 500 without visible difference, for example with `simplify-js`); reasonable precision (6 decimals in GPS is about 11 cm); **one trace = one row** in the database, never a "points" table with a million rows.

Worked cases in the guide: fleet tracking (200 trucks, GPS position every 10 s, kilometres driven, passing through a forbidden zone) is a PostGIS case.

## 16. Production checklist (p. 19)

To go through before each production release of a new model or table. An unchecked box is an assumed risk, not an oversight.

- [ ] The schema respects 3NF at least: no redundancy, each column depends on the whole key
- [ ] Every table has a primary key
- [ ] Every foreign key has an index on the child column
- [ ] No `SELECT *` in production queries
- [ ] Sensitive data is hashed or encrypted
- [ ] Queries use bound parameters (never concatenation)
- [ ] `created_at` / `updated_at` are present on business tables
- [ ] Migrations are tested on a recent production dump
- [ ] Destructive migrations have been analysed (locks, duration)
- [ ] The application database account has no DDL rights
- [ ] Business value lists are in a reference table (never an ENUM)
- [ ] `EXPLAIN` has been run on the most frequent queries
- [ ] Backups are tested (an untested backup is not a backup)
- [ ] Every table has a French `COMMENT ON TABLE` describing its role
- [ ] Every column has a French `COMMENT ON COLUMN`, no exception

## Points to settle

The guide and the project rules do not fit together everywhere. These points are recorded in [open points](open-points.md) (D-15, D-16) and must be settled with the team before the data model is formalised.

| ID | Point | Detail |
| --- | --- | --- |
| D-15 | Two naming styles in the guide | Sections 1, 2 and 6 name tables and columns in uppercase French with prefixes (`DT_SUPPRESSION`, `BL_ACTIF`). Sections 8, 12 and 16 use `created_at`, `updated_at`, `deleted_at` and English names (`audit_logs`, `is_active`). **Decided on 2026-11-03:** the technical columns (timestamps, soft delete, active flag) and the audit table use the English names of sections 8, 12 and 16; business columns keep the prefixed French names |
| D-16 | French names versus the English rule | The project rule is to write everything in English, identifiers included. The guide requires French names and French `COMMENT ON` text. `CLAUDE.md` records the French database objects as the only exception |
| D-17 | Table for users | Keycloak was dropped (A-06), so the table holds the credentials itself. **Decided on 2026-11-03:** `UTILISATEUR`, a business table with uppercase French singular naming and no prefix. `W_` is reserved for temporary or import tables (section 1), so it does not fit |
