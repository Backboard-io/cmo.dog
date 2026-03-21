#!/usr/bin/env bash
# Smoke test for the AI CMO API.
# Covers: health, auth, run creation, SSE streaming, and full data population.
#
# Usage:
#   ./scripts/smoke_test.sh                          # defaults
#   BASE_URL=http://localhost:9000 ./scripts/smoke_test.sh
#   TEST_URL=https://example.com ./scripts/smoke_test.sh
#
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:9000}"
TEST_URL="${TEST_URL:-https://8090.ai}"
POLL_MAX=90       # seconds to wait for run completion
POLL_INTERVAL=5
FIRST_SSE_WAIT=25 # seconds to wait for first log line (Backboard can be slow)

PASS=0
FAIL=0
_TMPDIR="$(mktemp -d)"
cleanup() { rm -rf "$_TMPDIR"; }
trap cleanup EXIT

pass() { echo "  PASS: $1"; (( PASS++ )) || true; }
fail() { echo "  FAIL: $1"; (( FAIL++ )) || true; }
section() { echo; echo "── $1 ──"; }

# ──────────────────────────────────────────────
# 1. Health
# ──────────────────────────────────────────────
section "1. Health check"
status=$(curl -sS -o "$_TMPDIR/health.json" -w "%{http_code}" "$BASE_URL/health")
if [[ "$status" == "200" ]]; then
  pass "GET /health → 200"
else
  fail "GET /health → $status (expected 200)"
  cat "$_TMPDIR/health.json" || true
  exit 1
fi

# ──────────────────────────────────────────────
# 2. Unauthenticated run creation is rejected
# ──────────────────────────────────────────────
section "2. Auth guard"
status=$(curl -sS -o "$_TMPDIR/noauth.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/runs" \
  -H "Content-Type: application/json" \
  -d '{"website_url":"https://example.com"}')
if [[ "$status" == "401" || "$status" == "422" ]]; then
  pass "POST /api/runs (no token) → $status"
else
  fail "POST /api/runs (no token) → $status (expected 401)"
fi

# ──────────────────────────────────────────────
# 3. Sign up / login to get a token
# ──────────────────────────────────────────────
section "3. Auth — get token"
TEST_EMAIL="smoke$(date +%s)@test.invalid"
TEST_PASS="Smoke99x!"

status=$(curl -sS -o "$_TMPDIR/signup.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}")

if [[ "$status" == "200" || "$status" == "201" ]]; then
  pass "POST /api/auth/signup → $status"
elif [[ "$status" == "409" ]]; then
  # Email already exists — fall back to login
  echo "  (email exists, trying login)"
  status=$(curl -sS -o "$_TMPDIR/signup.json" -w "%{http_code}" \
    -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}")
  if [[ "$status" == "200" ]]; then
    pass "POST /api/auth/login → $status (signup already existed)"
  else
    fail "POST /api/auth/login → $status"
    cat "$_TMPDIR/signup.json" || true
    exit 1
  fi
else
  fail "POST /api/auth/signup → $status (expected 200/201)"
  cat "$_TMPDIR/signup.json" || true
  exit 1
fi

TOKEN=$(python3 -c "import json,sys; print(json.load(open('$_TMPDIR/signup.json'))['token'])" 2>/dev/null || true)
if [[ -z "$TOKEN" ]]; then
  fail "Could not extract token from auth response"
  cat "$_TMPDIR/signup.json"
  exit 1
fi
pass "Token extracted (${TOKEN:0:8}…)"

# ──────────────────────────────────────────────
# 4. Create run
# ──────────────────────────────────────────────
section "4. Create run for $TEST_URL"
status=$(curl -sS -o "$_TMPDIR/run_create.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/runs" \
  -H "Content-Type: application/json" \
  -H "x-user-token: $TOKEN" \
  -d "{\"website_url\":\"$TEST_URL\"}")

if [[ "$status" == "200" || "$status" == "201" ]]; then
  pass "POST /api/runs → $status"
else
  fail "POST /api/runs → $status (expected 200)"
  cat "$_TMPDIR/run_create.json"
  exit 1
fi

RUN_ID=$(python3 -c "import json,sys; print(json.load(open('$_TMPDIR/run_create.json'))['run_id'])" 2>/dev/null || true)
if [[ -z "$RUN_ID" ]]; then
  fail "Could not extract run_id from response"
  cat "$_TMPDIR/run_create.json"
  exit 1
fi
pass "run_id = $RUN_ID"

# ──────────────────────────────────────────────
# 5. SSE stream — verify lines arrive in real-time
#    Connect to the stream, collect events within a 30s window.
#    If at least one line arrives within FIRST_SSE_WAIT s the stream is live.
# ──────────────────────────────────────────────
section "5. SSE stream — real-time delivery"
SSE_FILE="$_TMPDIR/sse.txt"
echo "  Listening to $BASE_URL/api/runs/$RUN_ID/stream for 30 s (first line within ${FIRST_SSE_WAIT}s)…"

# Stream log (stop after 30 s). On macOS without `timeout`, curl is killed via subshell.
curl -sS -N "$BASE_URL/api/runs/$RUN_ID/stream" > "$SSE_FILE" 2>/dev/null &
CURL_PID=$!
( sleep 60; kill "$CURL_PID" 2>/dev/null ) &

# Wait up to FIRST_SSE_WAIT for the first non-empty data line
FIRST_LINE_TIME=""
for i in $(seq 1 "$FIRST_SSE_WAIT"); do
  sleep 1
  if grep -q '"line"' "$SSE_FILE" 2>/dev/null; then
    FIRST_LINE_TIME=$i
    break
  fi
done

wait $CURL_PID 2>/dev/null || true
# grep -c prints 0 and exits 1 when there are no matches; never use `|| echo 0` (yields "0\n0").
LINE_COUNT=$(grep -c '"line"' "$SSE_FILE" 2>/dev/null || true)
LINE_COUNT=${LINE_COUNT:-0}
LINE_COUNT=${LINE_COUNT//$'\n'/}

if [[ -n "$FIRST_LINE_TIME" ]]; then
  pass "First SSE line received within ${FIRST_LINE_TIME}s"
else
  fail "No SSE lines received within ${FIRST_SSE_WAIT}s — stream may be blocked or silent"
  echo "  Raw SSE output:"
  head -20 "$SSE_FILE" || true
fi

if [[ "$LINE_COUNT" -ge 1 ]]; then
  pass "Received $LINE_COUNT SSE line(s) total"
  echo "  Sample lines:"
  grep '"line"' "$SSE_FILE" | head -5 | sed 's/^/    /'
else
  fail "Zero SSE lines in stream output"
fi

# ──────────────────────────────────────────────
# 6. Poll until run completes, then inspect fields
# ──────────────────────────────────────────────
section "6. Poll run until completed (max ${POLL_MAX}s)"
elapsed=0
RUN_STATUS="pending"

while [[ "$elapsed" -lt "$POLL_MAX" ]]; do
  curl -sS -o "$_TMPDIR/run.json" "$BASE_URL/api/runs/$RUN_ID" || true
  RUN_STATUS=$(python3 -c "import json,sys; print(json.load(open('$_TMPDIR/run.json')).get('status','unknown'))" 2>/dev/null || echo "error")
  echo "  [${elapsed}s] status = $RUN_STATUS"
  if [[ "$RUN_STATUS" == "completed" || "$RUN_STATUS" == "failed" ]]; then
    break
  fi
  sleep $POLL_INTERVAL
  elapsed=$(( elapsed + POLL_INTERVAL ))
done

if [[ "$RUN_STATUS" == "completed" ]]; then
  pass "Run completed in ~${elapsed}s"
elif [[ "$RUN_STATUS" == "failed" ]]; then
  fail "Run status = failed"
else
  fail "Run did not complete within ${POLL_MAX}s (last status: $RUN_STATUS)"
fi

# ──────────────────────────────────────────────
# 7. Inspect populated fields
# ──────────────────────────────────────────────
section "7. Field population checks"

check_field() {
  local label="$1"
  local expr="$2"
  local result
  result=$(python3 -c "
import json, sys
d = json.load(open('$_TMPDIR/run.json'))
val = $expr
if isinstance(val, (list, dict)):
    print('ok' if val else 'empty')
elif isinstance(val, str):
    print('ok' if val.strip() else 'empty')
else:
    print('empty')
" 2>/dev/null || echo "error")
  if [[ "$result" == "ok" ]]; then
    pass "$label"
  else
    fail "$label (got: $result)"
  fi
}

check_field "project_description (product info)" "d.get('project_description', '')"
check_field "brand_voice_snippet (brand voice)"  "d.get('brand_voice_snippet', '')"
check_field "competitor_report"                  "d.get('competitor_report') or ''"
check_field "competitors list"                   "d.get('competitors', [])"
check_field "analytics_overview"                 "d.get('analytics_overview', [])"
check_field "feed_items"                         "d.get('feed_items', [])"

# ── Content-quality checks (stub detection) ──────────────────────────────────

# product info: must be more than just the template header + site URL
PRODUCT_INFO_QUALITY=$(python3 -c "
import json, re
d = json.load(open('$_TMPDIR/run.json'))
val = d.get('project_description', '')
# Remove the common stub header pattern and the bare site line
stripped = re.sub(r'Product Information:\s*\S.*?\n+', '', val, flags=re.IGNORECASE).strip()
stripped = re.sub(r'^Site:\s*\S+\s*$', '', stripped, flags=re.IGNORECASE|re.MULTILINE).strip()
print('ok' if len(stripped) >= 60 else 'stub')
" 2>/dev/null || echo "error")
if [[ "$PRODUCT_INFO_QUALITY" == "ok" ]]; then
  pass "project_description has substantive content (not just header+URL)"
else
  fail "project_description is stub-only — only header and site URL, no real product info"
fi

# site description: project_description must contain a descriptive sentence beyond the site URL line
SITE_DESC_QUALITY=$(python3 -c "
import json, re
d = json.load(open('$_TMPDIR/run.json'))
val = d.get('project_description', '')
# Look for at least one sentence-like chunk (15+ word run) that is not just a URL
sentences = re.findall(r'[A-Za-z][^.!?\n]{14,}[.!?]', val)
print('ok' if sentences else 'missing')
" 2>/dev/null || echo "error")
if [[ "$SITE_DESC_QUALITY" == "ok" ]]; then
  pass "project_description contains a site description (descriptive sentences present)"
else
  fail "project_description has no site description — no descriptive sentences found"
fi

# brand voice: must have substantive content, not just a one-liner
BRAND_VOICE_QUALITY=$(python3 -c "
import json
d = json.load(open('$_TMPDIR/run.json'))
val = (d.get('brand_voice_snippet') or '').strip()
print('ok' if len(val) >= 60 else 'stub')
" 2>/dev/null || echo "error")
if [[ "$BRAND_VOICE_QUALITY" == "ok" ]]; then
  pass "brand_voice_snippet has substantive content"
else
  fail "brand_voice_snippet is stub-only or too short — brand voice drawer will look empty"
fi

# competitor report: must have an executive_summary and at least one data row
COMP_REPORT_QUALITY=$(python3 -c "
import json
d = json.load(open('$_TMPDIR/run.json'))
cr = d.get('competitor_report') or {}
summary = (cr.get('executive_summary') or '').strip()
rows = cr.get('rows') or []
if len(summary) >= 30 and len(rows) >= 1:
    print('ok')
elif not summary:
    print('no-summary')
else:
    print('no-rows')
" 2>/dev/null || echo "error")
if [[ "$COMP_REPORT_QUALITY" == "ok" ]]; then
  pass "competitor_report has executive_summary + data rows"
elif [[ "$COMP_REPORT_QUALITY" == "no-summary" ]]; then
  fail "competitor_report.executive_summary is empty — report is stub-only"
elif [[ "$COMP_REPORT_QUALITY" == "no-rows" ]]; then
  fail "competitor_report.rows is empty — no competitor data rows populated"
else
  fail "competitor_report quality check error ($COMP_REPORT_QUALITY)"
fi

# ── feed_items how_to_fix ─────────────────────────────────────────────────────

# Check that at least one feed item has how_to_fix populated
HOW_TO_FIX=$(python3 -c "
import json, sys
d = json.load(open('$_TMPDIR/run.json'))
items = d.get('feed_items', [])
filled = [i for i in items if i.get('how_to_fix','').strip()]
print(len(filled))
" 2>/dev/null || echo 0)

if [[ "$HOW_TO_FIX" -ge 1 ]]; then
  pass "feed_items[].how_to_fix populated ($HOW_TO_FIX item(s))"
else
  fail "feed_items[].how_to_fix is empty on all items — FixDrawer will show fallback message"
fi

# ──────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────
echo
echo "══════════════════════════════"
echo "  PASSED: $PASS   FAILED: $FAIL"
echo "══════════════════════════════"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
