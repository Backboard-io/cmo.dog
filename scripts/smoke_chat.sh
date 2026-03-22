#!/usr/bin/env bash
# Smoke test: end-to-end chat diagnostics.
#
# Usage:
#   ./scripts/smoke_chat.sh
#   BASE_URL=https://y6w2rrbbzj.us-west-2.awsapprunner.com ./scripts/smoke_chat.sh
#   BASE_URL=http://localhost:9000 TOKEN=<tok> RUN_ID=<id> ./scripts/smoke_chat.sh
#
# Set RUN_ID to skip run creation and test chat on an existing completed run.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:9000}"
TEST_URL="${TEST_URL:-https://8090.ai}"
POLL_MAX=180
POLL_INTERVAL=5

PASS=0
FAIL=0
_TMPDIR="$(mktemp -d)"
cleanup() { rm -rf "$_TMPDIR"; }
trap cleanup EXIT

pass() { echo "  PASS: $1"; (( PASS++ )) || true; }
fail() { echo "  FAIL: $1"; (( FAIL++ )) || true; }
section() { echo; echo "── $1 ──"; }

echo "Smoke test: chat flow"
echo "BASE_URL = $BASE_URL"

# ──────────────────────────────────────────────
# 1. Health
# ──────────────────────────────────────────────
section "1. Health"
status=$(curl -sS -o "$_TMPDIR/health.json" -w "%{http_code}" "$BASE_URL/health")
if [[ "$status" == "200" ]]; then
  pass "GET /health → 200"
else
  fail "GET /health → $status"
  cat "$_TMPDIR/health.json" || true
  exit 1
fi

# ──────────────────────────────────────────────
# 2. Auth — get or reuse token
# ──────────────────────────────────────────────
section "2. Auth"
TOKEN="${TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  TEST_EMAIL="smokechat$(date +%s)@test.invalid"
  TEST_PASS="Smoke99x!"

  status=$(curl -sS -o "$_TMPDIR/signup.json" -w "%{http_code}" \
    -X POST "$BASE_URL/api/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}")

  if [[ "$status" == "200" || "$status" == "201" ]]; then
    pass "POST /api/auth/signup → $status"
  else
    fail "POST /api/auth/signup → $status"
    cat "$_TMPDIR/signup.json" || true
    exit 1
  fi

  TOKEN=$(python3 -c "import json; print(json.load(open('$_TMPDIR/signup.json'))['token'])" 2>/dev/null || true)
  if [[ -z "$TOKEN" ]]; then
    fail "Could not extract token"
    cat "$_TMPDIR/signup.json"
    exit 1
  fi
  pass "Token extracted (${TOKEN:0:8}…)"
else
  pass "Reusing TOKEN from env (${TOKEN:0:8}…)"
fi

# ──────────────────────────────────────────────
# 3. Create run (or reuse RUN_ID)
# ──────────────────────────────────────────────
section "3. Run"
RUN_ID="${RUN_ID:-}"
if [[ -z "$RUN_ID" ]]; then
  echo "  Creating run for $TEST_URL …"
  status=$(curl -sS -o "$_TMPDIR/run_create.json" -w "%{http_code}" \
    -X POST "$BASE_URL/api/runs" \
    -H "Content-Type: application/json" \
    -H "x-user-token: $TOKEN" \
    -d "{\"website_url\":\"$TEST_URL\"}")

  if [[ "$status" == "200" || "$status" == "201" ]]; then
    pass "POST /api/runs → $status"
  else
    fail "POST /api/runs → $status"
    cat "$_TMPDIR/run_create.json"
    exit 1
  fi

  RUN_ID=$(python3 -c "import json; print(json.load(open('$_TMPDIR/run_create.json'))['run_id'])" 2>/dev/null || true)
  if [[ -z "$RUN_ID" ]]; then
    fail "Could not extract run_id"
    cat "$_TMPDIR/run_create.json"
    exit 1
  fi
  pass "run_id = $RUN_ID"
else
  pass "Reusing RUN_ID from env: $RUN_ID"
fi

# ──────────────────────────────────────────────
# 4. Poll until chat_status = "ready"
# ──────────────────────────────────────────────
section "4. Wait for chat ready (max ${POLL_MAX}s)"
elapsed=0
CHAT_STATUS="loading"
RUN_STATUS="pending"

while [[ "$elapsed" -lt "$POLL_MAX" ]]; do
  curl -sS -o "$_TMPDIR/run.json" \
    -H "x-user-token: $TOKEN" \
    "$BASE_URL/api/runs/$RUN_ID" || true

  RUN_STATUS=$(python3 -c "import json; d=json.load(open('$_TMPDIR/run.json')); print(d.get('status','?'))" 2>/dev/null || echo "error")
  CHAT_STATUS=$(python3 -c "import json; d=json.load(open('$_TMPDIR/run.json')); print(d.get('chat_status','?'))" 2>/dev/null || echo "error")

  echo "  [${elapsed}s] run=${RUN_STATUS}  chat=${CHAT_STATUS}"

  if [[ "$CHAT_STATUS" == "ready" ]]; then
    break
  fi
  if [[ "$RUN_STATUS" == "failed" ]]; then
    fail "Run failed before chat became ready"
    break
  fi

  sleep $POLL_INTERVAL
  elapsed=$(( elapsed + POLL_INTERVAL ))
done

if [[ "$CHAT_STATUS" == "ready" ]]; then
  pass "chat_status = ready in ~${elapsed}s"
else
  fail "chat_status never reached 'ready' (last: $CHAT_STATUS)"
  echo "  Full run JSON:"
  python3 -c "import json; print(json.dumps(json.load(open('$_TMPDIR/run.json')), indent=2))" 2>/dev/null || cat "$_TMPDIR/run.json" || true
  exit 1
fi

# ── Inspect greeting message ──────────────────────────────────────────────────
echo
echo "  Greeting message:"
python3 -c "
import json
d = json.load(open('$_TMPDIR/run.json'))
msgs = d.get('chat_messages', [])
for m in msgs:
    role = m.get('role', '?')
    content = m.get('content', '')
    print(f'    [{role}] {content[:120]}')
if not msgs:
    print('    (none)')
" 2>/dev/null || true

# ──────────────────────────────────────────────
# 5. Send chat message and check reply
# ──────────────────────────────────────────────
section "5. Chat round-trip"
CHAT_MSG="Could you give me a brief summary of what you found?"
echo "  → Sending: \"$CHAT_MSG\""

CHAT_START=$(date +%s)
HTTP_STATUS=$(curl -sS \
  -o "$_TMPDIR/chat_resp.json" \
  -w "%{http_code}" \
  -X POST "$BASE_URL/api/runs/$RUN_ID/chat" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$CHAT_MSG\"}")
CHAT_END=$(date +%s)
CHAT_ELAPSED=$(( CHAT_END - CHAT_START ))

echo "  HTTP status : $HTTP_STATUS  (took ${CHAT_ELAPSED}s)"
echo "  Raw response body:"
python3 -c "import json; print(json.dumps(json.load(open('$_TMPDIR/chat_resp.json')), indent=2))" 2>/dev/null \
  || cat "$_TMPDIR/chat_resp.json" || true

if [[ "$HTTP_STATUS" != "200" ]]; then
  fail "POST /api/runs/$RUN_ID/chat → $HTTP_STATUS (expected 200)"
  exit 1
fi
pass "POST /api/runs/.../chat → 200"

# ── Check assistant reply content ─────────────────────────────────────────────
REPLY_CHECK=$(python3 -c "
import json, sys
d = json.load(open('$_TMPDIR/chat_resp.json'))
msgs = d.get('messages', [])
# Find the last assistant message
assistant_msgs = [m for m in msgs if m.get('role') == 'assistant']
if not assistant_msgs:
    print('no-assistant-msg')
    sys.exit(0)
last = assistant_msgs[-1]
content = (last.get('content') or '').strip()
if len(content) == 0:
    print('empty')
elif len(content) < 10:
    print(f'too-short:{content}')
else:
    print('ok')
" 2>/dev/null || echo "parse-error")

case "$REPLY_CHECK" in
  ok)
    pass "Assistant reply received with content"
    ;;
  no-assistant-msg)
    fail "Response messages list has no assistant role message"
    ;;
  empty)
    fail "Assistant reply is empty string — Backboard returned no content"
    ;;
  too-short:*)
    fail "Assistant reply suspiciously short: ${REPLY_CHECK#too-short:}"
    ;;
  *)
    fail "Reply check failed: $REPLY_CHECK"
    ;;
esac

# ── Print the actual reply for inspection ─────────────────────────────────────
echo
echo "  Assistant reply:"
python3 -c "
import json
d = json.load(open('$_TMPDIR/chat_resp.json'))
msgs = d.get('messages', [])
for m in msgs:
    role = m.get('role', '?')
    content = (m.get('content') or '').strip()
    prefix = '  [assistant]' if role == 'assistant' else '  [user]    '
    print(f'{prefix} {content[:300]}')
" 2>/dev/null || true

# ──────────────────────────────────────────────
# 6. Verify 404 on unknown run_id (guard check)
# ──────────────────────────────────────────────
section "6. Chat 404 guard"
FAKE_ID="doesnotexist99"
status=$(curl -sS -o "$_TMPDIR/chat404.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/runs/$FAKE_ID/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}')
if [[ "$status" == "404" ]]; then
  pass "POST /api/runs/$FAKE_ID/chat → 404 (correct)"
else
  fail "POST /api/runs/$FAKE_ID/chat → $status (expected 404)"
  cat "$_TMPDIR/chat404.json" || true
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
