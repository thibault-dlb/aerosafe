#!/bin/bash
set -e

# Creates the database users and the database. Values come from the environment (.env).
# The migration user owns the database; the application user only works on the data.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER ${DB_MIGRATION_USER} WITH ENCRYPTED PASSWORD '${DB_MIGRATION_PASS}';
    CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASS}';
    CREATE DATABASE ${DB_NAME} OWNER ${DB_MIGRATION_USER};
EOSQL

# PostGIS needs a superuser, so the administrator creates the extensions in the application
# database. Every table the migrations create is then open to the application user, for data only.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    ALTER DEFAULT PRIVILEGES FOR ROLE ${DB_MIGRATION_USER} IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${DB_USER};
EOSQL

echo "Database ${DB_NAME} created, owned by ${DB_MIGRATION_USER}, used by ${DB_USER}"
