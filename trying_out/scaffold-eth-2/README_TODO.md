# 🔲 BeatStream — What Needs To Be Done

> Remaining work to go from "backend complete" to "hackathon-ready demo".

---

## ✅ Recently Completed

- [x] Supabase tables + seed data created (schema.sql)
- [x] Circle developer wallet created (`24071f33...` / `0xdfa721...`)
- [x] All API keys configured and working
- [x] Server compiles with 0 TS errors and starts cleanly
- [x] **ENS on-chain integration** — viem + NameWrapper on Sepolia
  - `registerArtistSubdomain()` → creates `<artist>.beatstream.eth` on-chain
  - `mintFanSubdomain()` → creates `fan-<wallet>.artist.beatstream.eth`
  - Read operations: `isSubdomainRegistered()`, `resolveENS()`, `getENSText()`
  - Write operations: `setENSTextRecord()` for avatar/url/description
  - Graceful fallback to simulation if we don't own parent name
- [x] **Database upgrade (migration_v2.sql)** — audio support + stream history
  - Tracks: `audio_url`, `genre`, `play_count` columns
  - Artists: `bio`, `genre`, `total_streams`, `ens_registered` columns
  - New tables: `fan_subdomains`, `stream_history`
  - RPC functions: `increment_play_count`, `increment_artist_streams`, `record_stream`, `get_fan_artist_beats`
  - Supabase Storage bucket `audio` for MP3 files
- [x] **ENS API routes** — `/api/ens/register-artist`, `/api/ens/mint-fan-subdomain`, `/api/ens/resolve/:name`, `/api/ens/check/:name`, `/api/ens/fan-subdomains/:wallet`
- [x] **Audio upload route** — `POST /api/tracks/:id/audio` with raw body upload to Supabase Storage
- [x] **Stream history** — settle endpoint now records stream history + increments play/artist counts
- [x] **Artist registration** — now accepts `bio` and `genre`

---

## 🔴 Critical Path (Must-Have)

### 1. Run Database Migration ⏳
- [ ] Run `packages/server/src/db/migration_v2.sql` in Supabase SQL Editor
- [ ] This adds audio columns, fan_subdomains table, stream_history table, and RPC functions
- [ ] Creates the `audio` storage bucket for MP3 files

### 2. Register `beatstream.eth` on Sepolia ⏳
- [ ] Go to [ENS App (Sepolia)](https://app.ens.domains/) on Sepolia testnet
- [ ] Register `beatstream.eth` using the server wallet (`0xBB2FB35525A59D0576B98FE0D162FAe442545A32`)
- [ ] Wrap it in NameWrapper so our server can create subdomains
- [ ] Without this, ENS operations fall back to "simulated" mode (still works for demo)

### 3. End-to-End Smoke Test ⏳
- [ ] Hit `GET /api/health` and `GET /api/status` — verify all green
- [ ] Test `POST /api/artists/register` with bio + genre
- [ ] Test `POST /api/tracks` with genre + audioUrl
- [ ] Test `POST /api/tracks/:id/audio` — upload an MP3
- [ ] Test `POST /api/ens/register-artist` — register ENS subdomain
- [ ] Test full stream → settle → check fan subdomain eligibility
- [ ] Test `POST /api/ens/mint-fan-subdomain` after 100+ beats streamed

### 4. Frontend (Separate Branch — Teammate) 🔲
- [ ] Landing page with wallet connect
- [ ] Deposit USDC page
- [ ] Streaming player with WebSocket + live beat counter + audio playback
- [ ] Artist profile with ENS name display
- [ ] Fan subdomain claim UI
- [ ] Merge into main when ready

---

## 🟡 Yellow Network — Deeper Integration (For $15k Prize)

ClearNode auth is connected. To strengthen:

- [ ] Verify full auth challenge-response completes
- [ ] Test actual app session open → state update → close lifecycle with ClearNode
- [ ] Deposit `ytest.usd` tokens into Yellow Custody contract on Sepolia
- [ ] Handle channel recovery on reconnection

---

## 🟡 Circle Arc — Deeper Integration (For $10k Prize)

SDK is connected with real API key + developer wallet. To strengthen:

- [ ] Deploy BeatStreamVault on Arc Testnet via Circle SDK
- [ ] Test real `settlePayment()` execution on-chain
- [ ] Set up webhook listener for deposit confirmations
- [ ] Use Circle's Gas Station for gasless user transactions

---

## 🟢 Nice-to-Have (If Time Permits)

### Audio Streaming
- [ ] Chunked audio delivery (5-second chunks gated by beat payment)
- [ ] `MediaSource` API for streaming playback in browser
- [ ] Waveform visualization

### Backend Hardening
- [ ] Rate limiting on API routes
- [ ] Request validation (zod schemas)
- [ ] Session timeout (auto-settle after inactivity)

### Testing & DevOps
- [ ] Hardhat unit tests for BeatStreamVault
- [ ] Server API integration tests
- [ ] Deploy contracts to Sepolia
- [ ] Deploy server to Railway/Fly.io
- [ ] Demo video + pitch deck

---

## 📋 Suggested Build Order

```
1. ✅ Supabase tables + seed data         (done)
2. ✅ Circle wallet creation              (done)
3. ✅ ENS on-chain integration            (done)
4. ✅ Database upgrade for audio          (done)
5. ⏳ Run migration_v2.sql in Supabase    (2 min)  ← NEXT
6. ⏳ Register beatstream.eth on Sepolia  (15 min)
7. ⏳ Smoke test all endpoints            (30 min)
8. ⏳ Yellow deposit ytest.usd + test     (1-2 hours)
9. ⏳ Frontend merge + wiring             (teammate)
10.⏳ End-to-end demo flow               (1 hour)
11.⏳ Polish + demo recording            (1-2 hours)
```

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

# ⚠️ STILL NEEDED (after Circle vault deployment)
CIRCLE_VAULT_CONTRACT_ID=            # After deploying vault via Circle
CIRCLE_USDC_CONTRACT_ID=             # After deploying vault via Circle
```
