#!/bin/bash
# ENS Smoke Test — runs server, tests, then kills server
set -e

SERVER_DIR="/home/imperial-x/Documents/GitHub/BeatStream/trying_out/scaffold-eth-2/packages/server"
BASE="http://localhost:4000"

# Kill anything on port 4000
lsof -ti :4000 | xargs -r kill 2>/dev/null || true
sleep 1

# Start server in background
cd "$SERVER_DIR"
npx tsx src/index.ts &
SERVER_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server (PID $SERVER_PID)..."
for i in $(seq 1 15); do
  if curl -s "$BASE/api/health" >/dev/null 2>&1; then
    echo "✅ Server is ready!"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "❌ Server did not start in time"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

echo ""
echo "╔═══════════════════════════════════╗"
echo "║   🧪 ENS Smoke Tests Starting     ║"
echo "╚═══════════════════════════════════╝"
echo ""

PASS=0
FAIL=0

run_test() {
  local name="$1"
  local url="$2"
  local expect_field="$3"

  echo "─── $name ───"
  RESP=$(curl -s "$url")
  echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

  if [ -n "$expect_field" ]; then
    if echo "$RESP" | grep -q "$expect_field"; then
      echo "  ✅ PASS (found '$expect_field')"
      PASS=$((PASS+1))
    else
      echo "  ❌ FAIL (missing '$expect_field')"
      FAIL=$((FAIL+1))
    fi
  else
    if [ -n "$RESP" ] && [ "$RESP" != "null" ]; then
      echo "  ✅ PASS (got response)"
      PASS=$((PASS+1))
    else
      echo "  ❌ FAIL (empty response)"
      FAIL=$((FAIL+1))
    fi
  fi
  echo ""
}

# Tests
run_test "1. GET /api/status" "$BASE/api/status" "services"
run_test "2. GET /api/ens/check/beatstream.eth" "$BASE/api/ens/check/beatstream.eth" "registered"
run_test "3. GET /api/ens/check/synthwave.beatstream.eth" "$BASE/api/ens/check/synthwave.beatstream.eth" "registered"
run_test "4. GET /api/ens/resolve/beatstream.eth" "$BASE/api/ens/resolve/beatstream.eth" "address"
run_test "5. GET /api/ens/fan-subdomains/0x1111111111111111111111111111111111111111" "$BASE/api/ens/fan-subdomains/0x1111111111111111111111111111111111111111" ""
run_test "6. GET /api/tracks" "$BASE/api/tracks" ""

echo "════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "════════════════════════════════════"

# Cleanup
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
echo "🛑 Server stopped."
