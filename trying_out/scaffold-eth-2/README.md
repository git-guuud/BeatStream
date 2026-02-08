# 🎵 BeatStream

**Pay-per-second music streaming powered by Web3** — built on [Scaffold-ETH 2](https://scaffoldeth.io).

Stream music, pay by the second using on-chain Beats (1000 Beats = 1 USDC), and earn ENS subdomains as a loyal fan.

> 🏆 Hackathon submission targeting **Yellow Network** ($15k), **Circle Arc** ($10k), and **ENS** ($5k) bounties.

---

## ⚡ Current Status — What Works Right Now

### ✅ What a user/developer CAN do today

| Action | How | Status |
|--------|-----|--------|
| **Start the server** | `cd packages/server && npx tsx src/index.ts` | ✅ Works — 0 TS errors, all services init |
| **Register as an artist** | `POST /api/artists/register` (wallet + signature) | ✅ Creates DB record, auto-generates `<name>.beatstream.eth` |
| **Register as a listener** | `POST /api/users/register` (wallet + signature) | ✅ Creates DB record with beats balance |
| **Browse tracks** | `GET /api/tracks` | ✅ Returns all tracks with genre, play_count, audio_url |
| **Create a track** | `POST /api/tracks` (artist only, sig-gated) | ✅ Stores in Supabase with genre + audioUrl |
| **Upload audio** | `POST /api/tracks/:id/audio` (raw MP3 body) | ✅ Uploads to Supabase Storage bucket |
| **Start a stream** | `POST /api/sessions/start` | ✅ Creates session + opens Yellow app session (or fallback) |
| **Stream via WebSocket** | `ws://localhost:4000/ws/stream` | ✅ Real-time beat_tick every second, debits 1 beat/sec |
| **Settle a stream** | `POST /api/sessions/settle` | ✅ Closes Yellow session + settles via Circle + credits artist + records stream history |
| **Check ENS subdomain** | `GET /api/ens/check/:name` | ✅ Queries NameWrapper on Sepolia |
| **Resolve ENS name** | `GET /api/ens/resolve/:name` | ✅ Queries PublicResolver on Sepolia |
| **View service status** | `GET /api/status` | ✅ Shows Yellow, Circle, ENS status in real-time |
| **List fan subdomains** | `GET /api/ens/fan-subdomains/:wallet` | ✅ Returns subdomains from DB |

### 🟡 What is CONNECTED but not fully end-to-end yet

| Integration | What's working | What's missing |
|-------------|---------------|----------------|
| **Yellow Network** | SDK imported, ClearNode WebSocket connects, auth request sent, app session/state update/close code written | ClearNode never responds to auth challenge (reconnect loop). No `ytest.usd` tokens deposited into Custody contract. App sessions can't actually open without auth. |
| **Circle Arc** | SDK imported, API key + entity secret registered, developer wallet created (`0xdfa721...`), settlement code written | BeatStreamVault not deployed on Arc Testnet via Circle SDK. `settlePayment()` will simulate/fail until vault is deployed. Missing `CIRCLE_VAULT_CONTRACT_ID` + `CIRCLE_USDC_CONTRACT_ID` in .env. |
| **ENS** | `beatstream.eth` registered on Sepolia (tx `0xc2413f...`), NameWrapper + Resolver contracts configured, all read/write functions written | `setSubnodeRecord()` will revert because NameWrapper doesn't recognize our wallet as the owner of the wrapped name (ENS app registration vs NameWrapper wrapping are separate). Artist subdomain registration falls back to "simulated" mode. Need to **wrap** `beatstream.eth` in NameWrapper or use `setSubnodeOwner` on the Registry directly. |

### ❌ What does NOT work yet

| Feature | Why |
|---------|-----|
| **Artist actually gets `<name>.beatstream.eth` on-chain** | NameWrapper `setSubnodeRecord` reverts — we own `beatstream.eth` but it may not be wrapped in NameWrapper. Falls back to simulation (returns success but no on-chain tx). |
| **Fan earns subdomain after 100+ beats** | Same NameWrapper issue. Eligibility check works, DB recording works, but on-chain minting simulates. |
| **Real USDC settlement to artist** | Circle vault not deployed on Arc Testnet. `settlePayment()` simulates. |
| **Real state channel payments** | Yellow auth never completes. All state channel calls return null/false gracefully. |
| **Frontend** | In progress on a separate branch by a teammate. Not merged. |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     BeatStream Stack                         │
├─────────────┬──────────────────┬────────────────────────────┤
│  Frontend   │     Backend      │        On-Chain            │
│  (Next.js)  │  (Express + WS)  │  (Solidity + ENS)         │
├─────────────┼──────────────────┼────────────────────────────┤
│ Wallet      │ REST API         │ BeatStreamVault.sol        │
│ Connect     │ WebSocket        │ MockUSDC.sol               │
│ ENS Display │ Supabase DB      │ ENS NameWrapper (Sepolia)  │
│ Player UI   │ Audio Storage    │                            │
├─────────────┴──────────────────┴────────────────────────────┤
│           Yellow Network          │      Circle Arc          │
│  (State channels via Nitrolite)   │  (Settlement + Wallets)  │
└───────────────────────────────────┴──────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ v20
- Yarn v1 or v2+
- Git

### 1. Install Dependencies

```bash
git clone https://github.com/IMPERIAL-X7/BeatStream.git
cd BeatStream/trying_out/scaffold-eth-2
yarn install
```

### 2. Set Up Environment

```bash
cp packages/server/.env.example packages/server/.env
# Fill in your API keys (Yellow, Circle, Alchemy, Supabase)
```

### 3. Deploy Contracts (Local)

```bash
# Terminal 1 — Start local chain
yarn chain

# Terminal 2 — Deploy
yarn deploy
```

### 4. Start Backend Server

```bash
cd packages/server
npx tsx src/index.ts
# Server starts on http://localhost:4000
```

### 5. Start Frontend

```bash
yarn start
# Frontend on http://localhost:3000
```

---

## 💰 How It Works

```
1. USER deposits USDC → gets Beats (1000 Beats = 1 USDC)
2. USER starts streaming a track → opens Yellow Network state channel
3. Every second: 1 Beat deducted → state channel updated in real-time
4. USER stops → session settles via Circle Arc → artist gets paid
5. After 100+ Beats streamed from one artist → fan earns ENS subdomain!
```

### Currency

| Unit | Value | Usage |
|------|-------|-------|
| 1 USDC | 1,000 Beats | Deposit conversion |
| 1 Beat | $0.001 | 1 second of streaming |
| 100 Beats | — | Fan subdomain threshold |

### ENS Subdomains

- **Artists** get `<name>.beatstream.eth` (e.g., `synthwave.beatstream.eth`)
- **Fans** earn `fan-<wallet>.artist.beatstream.eth` after streaming 100+ seconds

---

## 📡 API Endpoints

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/health` | GET | Health check |
| `/api/status` | GET | Service statuses (Yellow, Circle, ENS) |
| `/api/users` | POST `/register`, GET `/:wallet` | User auth (wallet signature) |
| `/api/artists` | POST `/register`, GET `/`, GET `/:id` | Artist registration + ENS |
| `/api/tracks` | POST `/`, GET `/`, GET `/:id`, POST `/:id/audio` | Track management + audio upload |
| `/api/deposit` | POST `/`, POST `/verify` | USDC deposit → Beats |
| `/api/sessions` | POST `/start`, POST `/settle`, GET `/:id` | Stream session lifecycle |
| `/api/ens` | POST `/register-artist`, POST `/mint-fan-subdomain`, GET `/resolve/:name`, GET `/check/:name`, GET `/fan-subdomains/:wallet` | On-chain ENS operations |
| `/ws/stream` | WebSocket | Real-time beat-by-beat streaming |

---

## � TODO — What Needs To Be Done Next

> **Read this if you're picking up the project.** Each section is ordered by priority.

### 🔴 Priority 1 — Make ENS subdomains work on-chain

**Problem**: We registered `beatstream.eth` on Sepolia via the ENS app, but the name may not be "wrapped" in the NameWrapper contract. Our code calls `NameWrapper.setSubnodeRecord()` which requires the caller to be the owner in the NameWrapper. If it's not wrapped, we need to either:

**Option A — Wrap it (preferred)**:
1. Go to [app.ens.domains](https://app.ens.domains/) → find `beatstream.eth` → click "Wrap Name" (if available)
2. This transfers ownership to the NameWrapper, which then lets our server call `setSubnodeRecord()`

**Option B — Use the Registry directly**:
1. Change `ens.ts` to call `ENSRegistry.setSubnodeOwner()` instead of `NameWrapper.setSubnodeRecord()`
2. Then call `Resolver.setAddr()` separately
3. This works with unwrapped names but doesn't set fuses/expiry

**Option C — Use `setSubnodeOwner` on NameWrapper**:
1. Some NameWrapper versions allow `setSubnodeOwner` for the parent name owner
2. Try wrapping + calling with the correct fuses

**How to test**: After fixing, run:
```bash
curl -X POST http://localhost:4000/api/ens/register-artist \
  -H "Content-Type: application/json" \
  -d '{"wallet": "<artist_wallet>", "signature": "<sig>", "nonce": 1}'
```
If `simulated: false` in the response, it worked on-chain.

### 🔴 Priority 2 — Make Yellow Network auth complete

**Problem**: The server connects to `wss://clearnet-sandbox.yellow.com/ws` and sends an auth request, but the ClearNode never sends back an `auth_challenge`. The WebSocket stays connected but auth never completes, so `authenticated = false` forever.

**Steps to fix**:
1. **Check if we need to deposit first**: Yellow may require `ytest.usd` tokens in the Custody contract before allowing auth
   - Custody contract: `0x019B65A265EB3363822f2752141b3dF16131b262` (Sepolia)
   - Token: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` (ytest.usd on Sepolia)
   - Steps: Mint/acquire test tokens → `approve()` Custody contract → `deposit()` into Custody
2. **Check the auth request format**: The `createAuthRequestMessage()` call may need different parameters. Compare with Yellow's example code.
3. **Check Yellow Discord/docs**: The sandbox may require whitelisting or a specific `app_name`.
4. **Test with Yellow's own example**: Clone `@erc7824/nitrolite` repo and try their example client.

**How to verify**: When auth works, the server will log:
```
🟡 Yellow: Auth challenge received
🟡 Yellow: Auth verify message sent
🟡 Yellow: ✅ Authenticated with ClearNode!
```

### 🔴 Priority 3 — Deploy BeatStreamVault on Circle Arc Testnet

**Problem**: The vault contract exists in `packages/hardhat/contracts/BeatStreamVault.sol` and is deployed locally, but not on Circle's Arc Testnet. Without it, `settlePayment()` simulates instead of doing real on-chain settlement.

**Steps**:
1. Use the Circle SDK to deploy:
   ```ts
   import { deployVaultContract } from "./services/arc.js";
   const result = await deployVaultContract();
   // Returns contractId — add to .env as CIRCLE_VAULT_CONTRACT_ID
   ```
2. Or deploy via Circle's dashboard at [console.circle.com](https://console.circle.com)
3. After deployment, set these in `.env`:
   ```
   CIRCLE_VAULT_CONTRACT_ID=<from Circle dashboard>
   CIRCLE_USDC_CONTRACT_ID=<USDC contract on Arc Testnet>
   ```
4. Test: `POST /api/sessions/settle` should show `settlement.success: true` with a real tx hash.

### 🟡 Priority 4 — Frontend (Separate Branch)

The frontend lives in `packages/nextjs/` on a separate branch. It needs:
1. Wallet connect (Scaffold-ETH 2 provides this)
2. Deposit USDC page → calls `POST /api/deposit`
3. Track browser → `GET /api/tracks`
4. Streaming player → connects to `ws://localhost:4000/ws/stream`
5. Artist profile → shows ENS name, bio, genre, total streams
6. Fan subdomain claim → `POST /api/ens/mint-fan-subdomain`

### 🟢 Priority 5 — Polish

- [ ] Run Hardhat tests for BeatStreamVault
- [ ] Add zod validation on all API routes
- [ ] Rate limiting
- [ ] Session timeout (auto-settle after inactivity)
- [ ] Demo video + pitch deck

---

## 📁 Project Structure

```
packages/
├── hardhat/                    # Smart contracts
│   ├── contracts/
│   │   ├── BeatStreamVault.sol # Core vault (deposit/settle/withdraw)
│   │   └── MockUSDC.sol        # Test USDC token
│   └── deploy/
│       └── 01_deploy_beatstream.ts
│
├── server/                     # Backend
│   └── src/
│       ├── index.ts            # Entry point (Express + WS)
│       ├── config/             # Constants + TypeScript types
│       ├── db/                 # Supabase client + schema + migrations
│       ├── lib/                # Signature verification
│       ├── routes/             # REST routes + WebSocket handler
│       │   ├── artists.ts
│       │   ├── tracks.ts
│       │   ├── sessions.ts
│       │   ├── ens.ts          # ENS on-chain routes
│       │   ├── deposit.ts
│       │   ├── users.ts
│       │   └── stream.ws.ts    # WebSocket streaming
│       └── services/           # SDK integrations
│           ├── yellow.ts       # Yellow Network (Nitrolite)
│           ├── arc.ts          # Circle Arc
│           └── ens.ts          # ENS (viem + NameWrapper)
│
└── nextjs/                     # Frontend (Scaffold-ETH 2)
    └── app/beatstream/         # BeatStream pages (WIP)
```

---

## 📖 More Documentation

- **[README_DONE.md](./README_DONE.md)** — Detailed technical breakdown of everything built
- **[README_TODO.md](./README_TODO.md)** — Granular remaining tasks with build order

---

## 🛠️ Built With

- [Scaffold-ETH 2](https://scaffoldeth.io) — Ethereum development stack
- [Yellow Network / Nitrolite](https://yellow.org) — State channel infrastructure
- [Circle Arc](https://developers.circle.com) — Smart contract platform
- [ENS](https://ens.domains) — Ethereum Name Service
- [Supabase](https://supabase.com) — PostgreSQL + Storage
- [viem](https://viem.sh) — TypeScript Ethereum client

---

## 📜 License

This project is licensed under the MIT License.
