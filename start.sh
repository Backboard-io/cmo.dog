#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

# Kill any stale Next.js / uvicorn processes from a previous run
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "uvicorn app.main" 2>/dev/null || true
sleep 1

# Clear only local runtime/build state — never .env or persisted data
rm -rf web/.next 2>/dev/null || true
rm -rf __pycache__ app/__pycache__ scripts/__pycache__ 2>/dev/null || true
rm -rf dist build *.egg-info 2>/dev/null || true

cleanup() {
  echo "Shutting down..."
  kill 0 2>/dev/null || true
  exit 0
}
trap cleanup EXIT SIGINT SIGTERM

# Start API in background
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 &
API_PID=$!

# Start frontend (dev)
cd web && npm run dev &
FE_PID=$!

wait $API_PID $FE_PID
