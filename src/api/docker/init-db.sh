#!/bin/bash
set -e

# Values come from the environment (.env). They reach SQL only as psql variables, quoted by
# psql itself, so any character is safe. The heredocs are quoted so bash leaves them untouched.
psql_as_admin() {
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$1" \
        -v app_user="$DB_USER" \
        -v app_pass="$DB_PASS" \
        -v app_db="$DB_NAME" \
        -v migration_user="$DB_MIGRATION_USER" \
        -v migration_pass="$DB_MIGRATION_PASS"
}

# Creates the database users and the database.
# The migration user owns the database; the application user only works on the data.
psql_as_admin "$POSTGRES_DB" <<-'EOSQL'
    CREATE USER :"migration_user" WITH ENCRYPTED PASSWORD :'migration_pass';
    CREATE USER :"app_user" WITH ENCRYPTED PASSWORD :'app_pass';
    CREATE DATABASE :"app_db" OWNER :"migration_user";
EOSQL

# PostGIS needs a superuser, so the administrator creates the extensions in the application
# database. Every table the migrations create is then open to the application user, for data only.
psql_as_admin "$DB_NAME" <<-'EOSQL'
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_user" IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
EOSQL

echo "Database ${DB_NAME} created, owned by ${DB_MIGRATION_USER}, used by ${DB_USER}"
