#!/bin/sh
set -eu

if [ "${TABLIODB_RUN_MIGRATIONS:-true}" = "true" ]; then
  retries="${TABLIODB_MIGRATION_RETRIES:-30}"

  until node apps/server/dist/bin/migrate.js; do
    retries=$((retries - 1))

    if [ "$retries" -le 0 ]; then
      echo "TablioDB migration failed after all retries." >&2
      exit 1
    fi

    echo "TablioDB migration failed; retrying in 2s (${retries} retries left)..." >&2
    sleep 2
  done
fi

exec "$@"
