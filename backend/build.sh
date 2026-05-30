#!/usr/bin/env bash
# Render build step for the API.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Seed demo data on first deploy (idempotent). Set SEED_DEMO=false to skip.
if [ "${SEED_DEMO:-true}" = "true" ]; then
  python manage.py seed_demo
fi
