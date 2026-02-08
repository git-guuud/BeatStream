# 🔲 BeatStream — What Needs To Be Done

> Remaining work to go from "backend complete" to "hackathon-ready demo".
> **Updated: Feb 8, 2026** — after ENS smoke test pass.

---

## ✅ What Has Been Completed

- [x] Smart contracts: `BeatStreamVault.sol` + `MockUSDC.sol` deployed to local Hardhat
- [x] Backend server: Express + WebSocket on port 4000, **0 TypeScript errors**
- [x] Supabase: All tables created + seed data (users, artists, tracks, sessions)
- [x] Migration v2: `fan_subdomains`, `stream_history` tables, RPC functions, `audio` storage bucket — **run in Supabase ✅**
- [x] Circle SDK: API key configured, entity secret registered, developer wallet created (`0xdfa721...`)
- [x] Yellow SDK: `@erc7824/nitrolite` v0.5.3 imported, ClearNode WebSocket connects
- [x] ENS: `beatstream.eth` registered on Sepolia (tx `0xc2413f...`, block 10217506)
- [x] ENS service: Full on-chain read/write code via viem + NameWrapper on Sepolia
- [x] ENS API routes: 5 endpoints mounted at `/api/ens/*`
- [x] Audio upload: `POST /api/tracks/:id/audio` → Supabase Storage
- [x] Stream history: settle endpoint records history + increments play count + artist streams
- [x] Fan subdomain eligibility check: integrated into session settle flow
- [x] All API keys configured in `.env`
- [x] Smoke test: All 6 endpoints return valid JSON responses ✅

---

## 🔴 What's Broken / Not Working — Fix These First

### 1. ENS Subdomain Registration Reverts (simulated mode)
**Symptom**: `POST /api/ens/register-artist` returns `simulated: true` instead of creating on-chain.
**Root cause**: `NameWrapper.setSubnodeRecord()` reverts because the server wallet may not be the owner in the NameWrapper. We registered `beatstream.eth` via the ENS app but it may not be "wrapped".
**Fix options**:
- **A)** Go to app.ens.domains → `beatstream.eth` → "Wrap Name" → this gives NameWrapper ownership
- **B)** Change `ens.ts` to use `ENSRegistry.setSubnodeOwner()` instead (works with unwrapped names)
- **C)** Use the ENS app to set our server wallet as an approved operator on the NameWrapper
**Time estimate**: 30 min – 1 hour
**How to verify**: Response has `simulated: false` and a real `txHash`.

### 2. Yellow Network Auth Never Completes
**Symptom**: Server logs `Auth request sent, waiting for challenge...` then nothing. ClearNode never responds. WebSocket reconnects every 5s.
**Root cause**: Unknown. Possibly:
- Need to deposit `ytest.usd` into Custody contract first
- Auth request format doesn't match what sandbox expects
- Sandbox may require whitelisting
**Fix steps**:
1. Check if Yellow requires a deposit before auth → Custody `0x019B65...` on Sepolia
2. Get `ytest.usd` tokens (`0x1c7D4B...` on Sepolia) — may need to mint or request from faucet
3. `approve()` Custody contract → `deposit()` tokens
4. Try auth again
5. If still fails, compare with Yellow's example code in `@erc7824/nitrolite` repo
**Time estimate**: 1-2 hours
**How to verify**: Server logs `✅ Authenticated with ClearNode!`

### 3. Circle Vault Not Deployed on Arc Testnet
**Symptom**: `settlePayment()` simulates. No real on-chain settlement.
**Root cause**: `CIRCLE_VAULT_CONTRACT_ID` and `CIRCLE_USDC_CONTRACT_ID` are placeholder values in `.env`.
**Fix steps**:
1. Deploy `BeatStreamVault.sol` on Arc Testnet via Circle SDK or dashboard
2. Set `CIRCLE_VAULT_CONTRACT_ID=<contractId>` in `.env`
3. Set `CIRCLE_USDC_CONTRACT_ID=<usdcContractId>` in `.env`
4. Restart server
**Time estimate**: 30 min
**How to verify**: `POST /api/sessions/settle` returns `settlement.success: true` with a real tx hash.

---

## 🟡 Workflow — Exactly What To Do Next

```
Step 1: Fix ENS wrapping                      (30 min)
  └─ Wrap beatstream.eth in NameWrapper OR switch to Registry calls
  └─ Test: POST /api/ens/register-artist → simulated: false ✅

Step 2: Fix Yellow auth                       (1-2 hrs)
  └─ Get ytest.usd tokens on Sepolia
  └─ Deposit into Custody contract
  └─ Test: server logs "Authenticated with ClearNode!" ✅

Step 3: Test Yellow app session lifecycle      (30 min)
  └─ Open app session → submit state updates → close
  └─ Test: POST /api/sessions/start returns appSessionId ✅

Step 4: Deploy vault on Circle Arc Testnet     (30 min)
  └─ Deploy BeatStreamVault via Circle SDK
  └─ Set CIRCLE_VAULT_CONTRACT_ID in .env
  └─ Test: POST /api/sessions/settle returns real tx hash ✅

Step 5: End-to-end test                        (1 hr)
  └─ Register artist → create track → upload audio
  └─ Register user → deposit USDC → start stream
  └─ Stream for 10 seconds via WebSocket
  └─ Settle → verify artist earnings + stream history
  └─ Check fan subdomain eligibility

Step 6: Frontend (separate branch)             (teammate)
  └─ Merge and wire to backend

Step 7: Polish + demo                          (1-2 hrs)
  └─ Demo video, pitch deck, final testing
```

---

## 🟢 Nice-to-Have (If Time Permits)

- [ ] Chunked audio delivery (5-second chunks gated by beat payment)
- [ ] `MediaSource` API for browser streaming playback
- [ ] Waveform visualization
- [ ] Rate limiting on API routes
- [ ] Zod validation on all request bodies
- [ ] Session timeout (auto-settle after inactivity)
- [ ] Hardhat unit tests for BeatStreamVault
- [ ] Deploy contracts to Sepolia (not just local)
- [ ] Deploy server to Railway/Fly.io
- [ ] Demo video + pitch deck

---

## 🔑 Environment Variables Status

```bash
# ✅ ALL CONFIGURED
YELLOW_PRIVATE_KEY=0xcd91...         # → wallet 0xBB2FB355... (also ENS signer)
ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
YELLOW_WS_URL=wss://clearnet-sandbox.yellow.com/ws
CIRCLE_API_KEY=TEST_API_KEY:67940...
CIRCLE_ENTITY_SECRET=3696d6ca...     # registered with Circle ✅
SUPABASE_URL=https://rxsqzlylziilhtkjzeeb.supabase.co
SUPABASE_ANON_KEY=eyJ...             # ✅
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
CIRCLE_WALLET_ID=24071f33-312a-...   # ✅ created
CIRCLE_WALLET_ADDRESS=0xdfa721...    # ✅ created
PORT=4000

# ⚠️ STILL PLACEHOLDER (need Circle vault deployment)
CIRCLE_VAULT_CONTRACT_ID=your_deployed_vault_contract_id
CIRCLE_USDC_CONTRACT_ID=             # After deploying on Arc Testnet
```
