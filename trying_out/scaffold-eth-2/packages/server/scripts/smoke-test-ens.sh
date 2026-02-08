#!/bin/bash
# ENS Smoke Test Script
BASE="http://localhost:4000"

echo ""
echo "🧪 BeatStream ENS Smoke Test"
echo "════════════════════════════════════════"

echo ""
echo "1️⃣  GET /api/status — ENS service status"
curl -s "$BASE/api/status" | python3 -m json.tool
echo ""

echo "2️⃣  GET /api/ens/check/beatstream.eth — Check parent domain"
curl -s "$BASE/api/ens/check/beatstream.eth" | python3 -m json.tool
echo ""

echo "3️⃣  GET /api/ens/check/synthwave.beatstream.eth — Check artist subdomain (should be unregistered)"
curl -s "$BASE/api/ens/check/synthwave.beatstream.eth" | python3 -m json.tool
echo ""

echo "4️⃣  GET /api/ens/resolve/beatstream.eth — Resolve parent domain"
curl -s "$BASE/api/ens/resolve/beatstream.eth" | python3 -m json.tool
echo ""

echo "5️⃣  GET /api/ens/fan-subdomains/0x1111111111111111111111111111111111111111 — List fan subdomains (should be empty)"
curl -s "$BASE/api/ens/fan-subdomains/0x1111111111111111111111111111111111111111" | python3 -m json.tool
echo ""

echo "6️⃣  GET /api/tracks — Check tracks have new columns"
curl -s "$BASE/api/tracks" | python3 -m json.tool
echo ""

echo "════════════════════════════════════════"
echo "✅ ENS Smoke Test Complete"
