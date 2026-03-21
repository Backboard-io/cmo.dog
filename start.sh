#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"


# Clear only local runtime/build state — never .env or persisted data
rm -rf web/.next 2>/dev/null || true
rm -rf __pycache__ app/__pycache__ scripts/__pycache__ 2>/dev/null || true
rm -rf dist build *.egg-info 2>/dev/null || true

# Free ports before starting so no stale host processes shadow the container.
# lsof -ti tcp:8000 | xargs -r kill -9 2>/dev/null || true

cleanup() {
  echo "Shutting down..."
  kill $BE_PID $FE_PID
  exit 0
}
trap cleanup EXIT SIGINT SIGTERM
uv run uvicorn app.main:app --host 0.0.0.0 --port 9000 --reload & 
BE_PID=$!
sleep 5 
cd web 

npm install --legacy-peer-deps && PORT=8000 NODE_ENV=production HOSTNAME=0.0.0.0 npm run dev &
FE_PID=$!

wait $BE_PID $FE_PID