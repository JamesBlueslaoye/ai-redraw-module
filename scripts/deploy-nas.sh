#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

LOG_FILE="$ROOT_DIR/data/nas-deploy.log"
mkdir -p "$ROOT_DIR/data"

if [ -f .env ]; then
  echo "Using .env for configuration"
else
  echo "No .env file found. Please copy .env.example to .env and fill in your keys."
  exit 1
fi

NODE_ENV=${NODE_ENV:-production}
PORT=${PORT:-3481}
HOST=${HOST:-0.0.0.0}

echo "Starting AI redraw service on $HOST:$PORT"
nohup npm start > "$LOG_FILE" 2>&1 &
echo "Service started. Logs: $LOG_FILE"
echo "Open: http://<NAS_IP>:$PORT/"
