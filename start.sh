#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ ! -x ".venv/bin/python" ]; then
  echo "[NEXUS] Virtualenv missing — bootstrapping .venv..."
  python3 -m venv .venv
  .venv/bin/pip install --no-cache-dir -r requirements.txt
fi

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-8000}"

exec .venv/bin/python run.py
