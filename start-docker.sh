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
  docker rm -f backboard-cmo-app
  exit 0
}
trap cleanup EXIT SIGINT SIGTERM

docker build -t backboard-cmo-app .
docker run -d --name backboard-cmo-app --env-file .env -p 8000:8000 backboard-cmo-app
docker logs -f backboard-cmo-app 2>/dev/null || true
