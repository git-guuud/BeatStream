# 🎵 BeatStream — What's Been Built

> **Pay-per-second music streaming on Web3**, built on Scaffold-ETH 2.
> Targeting **Yellow Network** ($15k), **Circle Arc** ($10k), and **ENS** ($5k) hackathon bounties.

---

## Architecture Overview

```
scaffold-eth-2/
├── packages/
│   ├── hardhat/          ← Smart contracts + deploy scripts
│   ├── nextjs/           ← Frontend (SE2 — separate branch by teammate)
│   └── server/           ← Express + WebSocket backend
```

| Layer | Tech | Status |
|-------|------|--------|
| **Contracts** | Solidity on Hardhat (localhost/Sepolia) | ✅ Complete & deployed |
| **Backend** | Express + WS + Supabase | ✅ Complete — 0 TS errors |
| **Yellow Network** | `@erc7824/nitrolite` v0.5.3 | ✅ Real SDK — connected to ClearNode |
| **Circle Arc** | `@circle-fin/smart-contract-platform` + `developer-controlled-wallets` | ✅ Real SDK — API key + entity secret registered |
| **ENS** | On-chain via viem + NameWrapper (Sepolia) | ✅ Complete — subdomain registration + fan minting |
| **Database** | Supabase (PostgreSQL + Storage) | ✅ Schema + seed data + audio storage |
| **API Keys** | Yellow, Circle, Alchemy, Supabase | ✅ All configured |
| **Frontend** | Next.js (SE2) | 🔲 Separate branch (in progress by teammate) |

---

## 🔗 Smart Contracts (`packages/hardhat/`)

### `BeatStreamVault.sol`
Core on-chain vault — deposit → stream → settle → withdraw lifecycle.

- **`deposit(uint256 amount)`** — User deposits USDC, gets off-chain Beats (1000 Beats = 1 USDC)
- **`settle(address artist, uint256 beatsUsed, address user)`** — Owner-only; pays artist from user's deposit
- **`withdraw()`** — User reclaims unspent USDC
- **`registerArtist(address artist)`** — Registers a valid artist
- **`getDeposit(address)`** / **`getArtistEarnings(address)`** / **`vaultBalance()`** — Read-only queries
- Events: `Deposited`, `Settled`, `Withdrawn`, `ArtistRegistered`
- Constants: `BEATS_PER_USDC = 1000`, `USDC_PER_BEAT = 1e3`

### `MockUSDC.sol`
Test ERC20 with open `mint()`. 6 decimals, mirrors real USDC.

### Deploy Scripts
- `01_deploy_beatstream.ts` — Deploys MockUSDC → BeatStreamVault, mints 1000 USDC to deployer
- **Status**: ✅ Deployed to local hardhat (`deployments/localhost/`)

---

## 🖥️ Backend Server (`packages/server/`)

A standalone Express + WebSocket server wired into the SE2 monorepo as a yarn workspace (`@beatstream/server`).

```bash
cd packages/server && npx tsx src/index.ts    # Starts on port 4000
```

### Services — Real SDK Integrations

#### `services/yellow.ts` — Yellow Network ✅
Full `@erc7824/nitrolite` integration with ClearNode sandbox WebSocket:
- **Auth**: EIP-712 challenge-response (`createAuthRequestMessage` → `createEIP712AuthMessageSigner` → `createAuthVerifyMessageFromChallenge`)
- **Session keys**: Ephemeral `createECDSAMessageSigner` per server restart
- **App sessions**: `createAppSessionMessage` — 2-party payment channels (user ↔ server)
- **State updates**: `createSubmitAppStateMessage` — shifts 1 beat/second user→server
- **Close**: `createCloseAppSessionMessage` — finalizes with payout split
- **Channel mgmt**: `createGetChannelsMessage` + `createCloseChannelMessage`
- **Auto-reconnect**: WebSocket reconnects on disconnect (5s backoff)

#### `services/arc.ts` — Circle Arc ✅
Full `@circle-fin/smart-contract-platform` + `@circle-fin/developer-controlled-wallets`:
- **Wallets**: `createArcWallet()` — dev-controlled wallet on Arc Testnet
- **Deploy**: `deployVaultContract()` — deploy BeatStreamVault via Circle SDK
- **Queries**: `queryVaultBalance()`, `queryUserDeposit()`, `queryArtistEarnings()` via `queryContract()`
- **Settlement**: `settlePayment()` — calls `vault.settle()` via `createContractExecutionTransaction()`
- **Verification**: `verifyDeposit()` — checks tx status via Circle API
- **Fallback**: Simulates when API keys aren't configured

#### `services/ens.ts` — ENS ✅ (On-Chain)
Full on-chain integration via viem + ENS NameWrapper on Sepolia:
- **Initialization**: Creates viem `PublicClient` + `WalletClient` connected to Sepolia via Alchemy RPC
- **Artist subdomains**: `registerArtistSubdomain()` → calls `NameWrapper.setSubnodeRecord()` to create `<artist>.beatstream.eth` on-chain
- **Fan subdomains**: `mintFanSubdomain()` → creates `fan-<walletPrefix>.<artist>.beatstream.eth` after 100+ beats streamed
- **Read operations**: `isSubdomainRegistered()`, `resolveENS()`, `getENSText()` — check on-chain state
- **Write operations**: `setENSTextRecord()` — set avatar, url, description text records
- **Name generation**: `generateArtistENS("SynthWave")` → `synthwave.beatstream.eth`
- **Fan eligibility**: `checkFanSubdomainEligibility()` — ≥100 beats streamed from an artist
- **Graceful fallback**: If server doesn't own parent name, operations are simulated (demo-safe)
- **ENS Contracts** (Sepolia): NameWrapper `0x0635...`, Resolver `0x8FAD...`, Registry `0x0000...000C2E074eC69A0dFb`

### API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/artists` | `POST /register`, `GET /`, `GET /:id` | Artist registration with sig verification + ENS auto-gen + bio/genre |
| `/api/users` | `POST /register`, `GET /:wallet` | User registration/login with signature auth |
| `/api/deposit` | `POST /`, `POST /verify` | USDC deposit verification → Beats credit |
| `/api/tracks` | `POST /`, `GET /`, `GET /:id`, `POST /:id/audio` | Track CRUD (artists only, sig-gated) + audio file upload |
| `/api/sessions` | `POST /start`, `POST /settle`, `GET /:id` | Start (opens Yellow session) → Settle (closes + Arc settlement + stream history + ENS check) |
| `/api/ens` | `POST /register-artist`, `POST /mint-fan-subdomain`, `GET /resolve/:name`, `GET /check/:name`, `GET /fan-subdomains/:wallet` | On-chain ENS operations |
| `/ws/stream` | WebSocket | Real-time: `start_stream` → 1 beat/sec tick → `beat_tick` events → `stop_stream` |
| `/api/health` | `GET` | Health check |
| `/api/status` | `GET` | All service statuses (Yellow, Arc, ENS) |

### Database Layer

#### Schema (`db/schema.sql`)
- **`users`** — wallet, role (listener/artist), beats_balance, ens_name
- **`artists`** — wallet, display_name, ens_name, avatar_url, earnings, bio, genre, total_streams, ens_registered
- **`tracks`** — artist_id, title, duration, is_private, audio_url, genre, play_count
- **`sessions`** — user ↔ artist ↔ track, status, total_beats_paid

#### Upgrade (`db/migration_v2.sql`)
- **`fan_subdomains`** — fan_wallet, artist_id, subdomain, total_beats_streamed, tx_hash
- **`stream_history`** — user_wallet, artist_id, track_id, session_id, beats_paid, duration_seconds
- RPC functions: `increment_play_count`, `increment_artist_streams`, `record_stream`, `get_fan_artist_beats`
- Supabase Storage bucket `audio` for MP3 uploads (public read)

#### Helpers (`db/supabase.ts`)
Full CRUD + business logic:
- User: `getUser`, `createUser`, `creditBeats`, `debitBeat`
- Artist: `getArtists`, `createArtist`, `updateArtist`, `getArtistByWallet`
- Track: `getTracks`, `createTrack` (with audioUrl + genre), `updateTrackAudio`, `uploadAudioFile`
- Session: `createSession`, `getSession`, `incrementSessionPayment`, `settleSession`
- Stream history: `recordStream`, `incrementPlayCount`, `incrementArtistStreams`, `getFanArtistBeats`
- Fan subdomains: `getFanSubdomain`, `createFanSubdomain`, `getFanSubdomains`

### Utility
- `lib/verify.ts` — Wallet sig verification via viem (`verifyMessage`)
- `config/constants.ts` — All constants (Yellow contracts, Circle config, ENS domain, beat rates)
- `config/types.ts` — All TypeScript interfaces (User, Artist, Track, Session, FanSubdomain, StreamHistory)

### Scripts
- `scripts/register-entity-secret.ts` — ✅ Already run. Registered Circle entity secret ciphertext.
- `scripts/setup-circle-wallet.ts` — ✅ Already run. Created wallet `24071f33...` / `0xdfa721...`

---

## Streaming Flow

```
Frontend                        Server (REST)               Server (WS)                 Yellow ClearNode
   │                                │                           │                           │
   │ POST /sessions/start ─────────▶│                           │                           │
   │                                │── openStreamSession() ───────────────────────────────▶│
   │                                │   createAppSessionMessage()                           │
   │◀── {session, appSessionId} ───│                           │                           │
   │                                │                           │                           │
   │ WS: {type:"start_stream"} ───────────────────────────────▶│                           │
   │                              1s │◀── debitBeat(user) ──────│                           │
   │◀── {type:"beat_tick", 999} ───────────────────────────────│── updateStreamState() ───▶│
   │◀── {type:"beat_tick", 998} ───────────────────────────────│── submitAppState() ──────▶│
   │        ...                     │                           │                           │
   │ WS: {type:"stop_stream"} ────────────────────────────────▶│                           │
   │                                │                           │                           │
   │ POST /sessions/settle ────────▶│── closeStreamSession() ──────────────────────────────▶│
   │                                │── settlePayment() (Arc) ──│   closeAppSession()       │
   │                                │── creditArtistEarnings() ─│                           │
   │                                │── recordStream() ─────────│   (stream history)        │
   │                                │── incrementPlayCount() ───│                           │
   │                                │── incrementArtistStreams()─│                           │
   │◀── {settlement, fanSubdomain}─│                           │                           │
```

---

## 🔑 API Keys — All Configured ✅

| Key | Status |
|-----|--------|
| `YELLOW_PRIVATE_KEY` | ✅ Set — wallet `0xBB2FB355...` (also ENS signer on Sepolia) |
| `ALCHEMY_RPC_URL` | ✅ Set — Sepolia RPC |
| `YELLOW_WS_URL` | ✅ Set — `wss://clearnet-sandbox.yellow.com/ws` |
| `CIRCLE_API_KEY` | ✅ Set — `TEST_API_KEY:67940...` |
| `CIRCLE_ENTITY_SECRET` | ✅ Set + registered with Circle |
| `CIRCLE_WALLET_ID` | ✅ Set — `24071f33-312a-...` |
| `CIRCLE_WALLET_ADDRESS` | ✅ Set — `0xdfa721...` |
| `SUPABASE_URL` | ✅ Set |
| `SUPABASE_ANON_KEY` | ✅ Set |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set |

---

## 🚀 Server Startup

```
🎵 BeatStream Server starting...

✅ Supabase connected
✅ Circle Arc initialized
   Wallet ID: 24071f33-312a-5038-a618-68667ba8306b
   ENS server signer: 0xBB2FB35525A59D0576B98FE0D162FAe442545A32
✅ ENS service initialized (on-chain mode — Sepolia)
🟡 Yellow: Server wallet = 0xBB2FB35525A59D0576B98FE0D162FAe442545A32
🟡 Yellow: Session key = 0xB5f358fc4657669D7F038caEb261a84F751Cb006
🟡 Yellow: ClearNode WebSocket connected
🟡 Yellow: Auth request sent, waiting for challenge...
✅ WebSocket server initialized on /ws/stream

╔═══════════════════════════════════════════╗
║  🎵  BeatStream Server                    ║
║  📡  REST API:  http://localhost:4000     ║
║  🔌  WS:       ws://localhost:4000/ws/stream ║
║  ❤️   Health:   http://localhost:4000/api/health ║
╚═══════════════════════════════════════════╝
```

**TypeScript: 0 errors** ✅ | **Server: starts cleanly** ✅

---

## 📦 Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@erc7824/nitrolite` | ^0.5.3 | Yellow Network Nitrolite SDK |
| `@circle-fin/smart-contract-platform` | latest | Circle Contracts SDK |
| `@circle-fin/developer-controlled-wallets` | latest | Circle Wallets SDK |
| `@supabase/supabase-js` | ^2.49.0 | Database client + Storage |
| `viem` | ^2.21.0 | Ethereum + signature verification + ENS on-chain |
| `express` | ^4.21.0 | REST API |
| `ws` | ^8.18.0 | WebSocket streaming |

---

## 💰 Currency System

| Unit | Value | Usage |
|------|-------|-------|
| 1 USDC | 1,000 Beats | Deposit rate |
| 1 Beat | 0.001 USDC | 1 second of streaming |
| 1 Chunk | 5 Beats | Audio delivery unit (5 seconds) |
| 100 Beats | — | Fan subdomain threshold |
