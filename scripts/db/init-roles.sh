#!/bin/sh
set -eu

: "${SAMRIAN_APP_DB_PASSWORD:?SAMRIAN_APP_DB_PASSWORD is required}"
: "${SAMRIAN_AUTH_DB_PASSWORD:?SAMRIAN_AUTH_DB_PASSWORD is required}"
: "${SAMRIAN_WORKER_DB_PASSWORD:?SAMRIAN_WORKER_DB_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$SAMRIAN_APP_DB_PASSWORD" \
  -v auth_password="$SAMRIAN_AUTH_DB_PASSWORD" \
  -v worker_password="$SAMRIAN_WORKER_DB_PASSWORD" <<'SQL'
SELECT 'CREATE ROLE samrian_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'samrian_app') \gexec
SELECT 'CREATE ROLE samrian_auth NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'samrian_auth') \gexec
SELECT 'CREATE ROLE samrian_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'samrian_worker') \gexec
SELECT format('CREATE ROLE samrian_app_runtime LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'samrian_app_runtime') \gexec
SELECT format('CREATE ROLE samrian_auth_runtime LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS', :'auth_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'samrian_auth_runtime') \gexec
SELECT format('CREATE ROLE samrian_worker_runtime LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS', :'worker_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'samrian_worker_runtime') \gexec
GRANT samrian_app TO samrian_app_runtime;
GRANT samrian_auth TO samrian_auth_runtime;
GRANT samrian_worker TO samrian_worker_runtime;
SQL
