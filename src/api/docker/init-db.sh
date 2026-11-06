#!/bin/bash
set -e

# Creates the application user and database. Values come from the environment (.env).
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASS}';
    CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
    GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
EOSQL

# PostGIS needs a superuser, so the administrator creates it in the application database.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS postgis;
EOSQL

echo "Database ${DB_NAME} created for user ${DB_USER}"
