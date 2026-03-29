#!/bin/sh
set -eu

if [ -d "/app/supabase/migrations" ]; then
  echo "Ensuring migration tracking table exists..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.timetravelmap_migrations (
  name text primary key,
  applied_at timestamptz not null default timezone('utc', now())
);
SQL

  for file in /app/supabase/migrations/*.sql; do
    [ -f "$file" ] || continue

    name="$(basename "$file")"
    applied="$(psql "$DATABASE_URL" -Atqc "select 1 from public.timetravelmap_migrations where name = '$name' limit 1")"

    if [ "$applied" = "1" ]; then
      echo "Skipping already applied migration: $name"
      continue
    fi

    echo "Applying migration: $name"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "insert into public.timetravelmap_migrations (name) values ('$name')"
  done
else
  echo "No supabase/migrations directory found; skipping SQL migrations."
fi

exec node server.js
