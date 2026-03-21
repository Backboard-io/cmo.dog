#!/usr/bin/env bash
# Stream smoke test — mirrors what the UI does.
# Shows every SSE line timestamped + periodic run-state polls.
#
# Usage:
#   ./scripts/smoke_stream.sh
#   BASE_URL=http://localhost:9000 TEST_URL=https://backboard.io ./scripts/smoke_stream.sh
#
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:9000}"
TEST_URL="${TEST_URL:-https://backboard.io}"
MAX_SECS="${MAX_SECS:-240}"

_TMPDIR="$(mktemp -d)"
SSE_LOG="$_TMPDIR/sse.raw"
touch "$SSE_LOG"

CURL_PID=""
cleanup() {
  [[ -n "$CURL_PID" ]] && kill "$CURL_PID" 2>/dev/null || true
  rm -rf "$_TMPDIR"
}
trap cleanup EXIT INT TERM

ts() { date "+%H:%M:%S"; }

echo "========================================"
echo "  CMO.dog SSE Stream Smoke Test"
echo "  BASE_URL : $BASE_URL"
echo "  TEST_URL : $TEST_URL"
echo "========================================"

# ── 1. Signup ────────────────────────────────────────────────────────────────
EMAIL="stream$(date +%s)@test.invalid"
PASS="Smoke99x!"
echo
echo "[$(ts)] Signing up $EMAIL …"
status=$(curl -sS -o "$_TMPDIR/signup.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")

if [[ "$status" != "200" && "$status" != "201" ]]; then
  echo "FAIL: signup → $status"; cat "$_TMPDIR/signup.json"; exit 1
fi
TOKEN=$(python3 -c "import json; print(json.load(open('$_TMPDIR/signup.json'))['token'])")
echo "[$(ts)] token = ${TOKEN:0:12}…"

# ── 2. Create run ────────────────────────────────────────────────────────────
echo
echo "[$(ts)] POST /api/runs → $TEST_URL"
status=$(curl -sS -o "$_TMPDIR/run.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/runs" \
  -H "Content-Type: application/json" \
  -H "x-user-token: $TOKEN" \
  -d "{\"website_url\":\"$TEST_URL\"}")

if [[ "$status" != "200" && "$status" != "201" ]]; then
  echo "FAIL: create run → $status"; cat "$_TMPDIR/run.json"; exit 1
fi
RUN_ID=$(python3 -c "import json; print(json.load(open('$_TMPDIR/run.json'))['run_id'])")
echo "[$(ts)] run_id = $RUN_ID"

# ── 3. Open SSE stream in background ─────────────────────────────────────────
echo
echo "[$(ts)] Connecting to stream…"
echo "─────────────────────────────────────────────────────"
curl -sS -N "$BASE_URL/api/runs/$RUN_ID/stream" >> "$SSE_LOG" 2>/dev/null &
CURL_PID=$!

# ── 4. Read + timestamp SSE lines as they arrive, poll run state every 15s ───
LINE_NUM=0
START=$(date +%s)
LAST_POLL=$START

parse_line() {
  # extract .line from a raw SSE data: {...} event
  python3 -c "
import sys, json
raw = sys.stdin.read().strip()
if raw.startswith('data:'):
    raw = raw[5:].strip()
try:
    d = json.loads(raw)
    v = d.get('line','')
    if v: print(v)
except:
    pass
" 2>/dev/null || true
}

poll_run() {
  curl -sS -o "$_TMPDIR/state.json" \
    -H "x-user-token: $TOKEN" \
    "$BASE_URL/api/runs/$RUN_ID" 2>/dev/null || true
  python3 -c "
import json, sys
try:
    d = json.load(open('$_TMPDIR/state.json'))
    status  = d.get('status','?')
    desc    = len(d.get('project_description') or '')
    comps   = len(d.get('competitors') or [])
    brand   = len(d.get('brand_voice_snippet') or '')
    audit   = len(d.get('audit_summary') or '')
    feed    = len(d.get('feed_items') or [])
    print(f'status={status} desc={desc}c comps={comps} brand={brand}c audit={audit}c feed={feed}')
except Exception as e:
    print(f'parse error: {e}')
" 2>/dev/null || true
}

while true; do
  NOW=$(date +%s)
  ELAPSED=$(( NOW - START ))

  # Timeout guard
  if (( ELAPSED >= MAX_SECS )); then
    echo "[$(ts)] MAX_SECS ($MAX_SECS) reached — stopping."
    break
  fi

  # Check if curl is still running
  if ! kill -0 "$CURL_PID" 2>/dev/null; then
    echo "[$(ts)] SSE curl exited."
    break
  fi

  # Read any new lines from SSE log
  TOTAL=$(wc -l < "$SSE_LOG" 2>/dev/null || echo 0)
  TOTAL=$(echo "$TOTAL" | tr -d ' ')
  if (( TOTAL > LINE_NUM )); then
    while (( LINE_NUM < TOTAL )); do
      LINE_NUM=$(( LINE_NUM + 1 ))
      RAW=$(sed -n "${LINE_NUM}p" "$SSE_LOG" 2>/dev/null || true)
      [[ -z "$RAW" ]] && continue
      PARSED=$(echo "$RAW" | parse_line)
      if [[ -n "$PARSED" ]]; then
        echo "[$(ts)] SSE  +${ELAPSED}s | $PARSED"
      fi
    done
  fi

  # Poll every 15s
  if (( NOW - LAST_POLL >= 15 )); then
    LAST_POLL=$NOW
    STATE=$(poll_run)
    echo "[$(ts)] POLL +${ELAPSED}s | $STATE"
    # Stop if run completed or failed
    if echo "$STATE" | grep -q "status=completed\|status=failed"; then
      echo "[$(ts)] Run finished — done."
      break
    fi
  fi

  sleep 1
done

kill "$CURL_PID" 2>/dev/null || true

# ── 5. Summary ───────────────────────────────────────────────────────────────
echo "─────────────────────────────────────────────────────"
SSE_COUNT=$(grep -c '"line"' "$SSE_LOG" 2>/dev/null || echo 0)
echo "[$(ts)] Total SSE lines received: $SSE_COUNT"
echo
echo "Full SSE timeline:"
python3 -c "
import json, sys
with open('$SSE_LOG') as f:
    for i, raw in enumerate(f, 1):
        raw = raw.strip()
        if raw.startswith('data:'):
            raw = raw[5:].strip()
        try:
            d = json.loads(raw)
            v = d.get('line','')
            if v:
                print(f'  {i:3}. {v}')
        except:
            pass
" 2>/dev/null || true
