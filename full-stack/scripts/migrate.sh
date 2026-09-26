#!/bin/sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
for f in db/migrations/*.sql; do
  echo "Applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
echo "Migrations complete."
