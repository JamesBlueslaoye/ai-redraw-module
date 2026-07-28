#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${TARGET_DIR:-/Volumes/docker/AIredrawtool}"

if [[ ! -d "$TARGET_DIR" ]]; then
  mkdir -p "$TARGET_DIR"
fi

mkdir -p "$TARGET_DIR/data"

rsync -a --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'data/' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

rm -rf "$TARGET_DIR/.github"
rm -rf "$TARGET_DIR/docs"
rm -rf "$TARGET_DIR/source-snapshots"

echo "Synced project to $TARGET_DIR"
echo "Next: open the NAS project and run docker compose up -d --build"