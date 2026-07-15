#!/usr/bin/env bash
# Start the soundbar remote. Creates a local venv on first run.
set -euo pipefail
cd "$(dirname "$0")"

PY="${PYTHON:-python3}"

if [ ! -d .venv ]; then
  echo "creating virtualenv..."
  "$PY" -m venv .venv
fi

# install/upgrade deps only when requirements.txt changed
if [ ! -f .venv/.deps-stamp ] || [ requirements.txt -nt .venv/.deps-stamp ]; then
  echo "installing dependencies..."
  .venv/bin/pip install --quiet -r requirements.txt
  touch .venv/.deps-stamp
fi

if [ ! -f .env ] && [ "${MOCK:-}" = "" ]; then
  echo ""
  echo "  No .env found. Copy .env.example to .env and add your Bose login,"
  echo "  or try the UI first with a fake soundbar:  MOCK=1 ./run.sh"
  echo ""
fi

exec .venv/bin/python -m app.main
