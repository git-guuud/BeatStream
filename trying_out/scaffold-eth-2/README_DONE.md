# 🎵 BeatStream — What's Been Built

> **Pay-per-second music streaming on Web3**, built on Scaffold-ETH 2.
> Targeting **Yellow Network** ($15k), **Circle Arc** ($10k), and **ENS** ($5k) hackathon bounties.

---

## Architecture Overview

```
scaffold-eth-2/
├── packages/
│   ├── hardhat/          ← Smart contracts + deploy scripts
│   ├── nextjs/           ← Frontend (SE2 default + BeatStream placeholders)
│   └── server/           ← Express + WebSocket backend (NEW)
```

BeatStream is a **three-layer stack**:

| Layer | Tech | Status |
|-------|------|--------|
| **Contracts** | Solidity on Hardhat (Sepolia) | ✅ Complete |
| **Backend** | Express + WS + Supabase | ✅ Complete |
| **Frontend** | Next.js (SE2) | 🔲 Placeholder pages only |

---

## 🔗 Smart Contracts (`packages/hardhat/`)

### `BeatStreamVault.sol`
The core on-chain vault that holds USDC and manages the deposit → stream → settle → withdraw lifecycle.

- **`deposit(uint256 amount)`** — User deposits USDC, gets off-chain Beats (1000 Beats = 1 USDC)
- **`settle(address artist, uint256 beatsUsed, address user)`** — Owner-only; converts streamed Beats to USDC and pays the artist
- **`withdraw()`** — User reclaims unspent USDC from the vault
- **`registerArtist(address artist)`** — Registers a wallet as a valid artist
- Events: `Deposited`, `Settled`, `Withdrawn`, `ArtistRegistered`
- Constants: `BEATS_PER_USDC = 1000`, `USDC_PER_BEAT = 1e3` (in 6-decimal base units)

### `MockUSDC.sol`
A test ERC20 with open `mint()` for hackathon/testnet convenience. 6 decimals, mirrors real USDC interface.

### `01_deploy_beatstream.ts`
Hardhat deploy script that:
1. Deploys `MockUSDC`
2. Deploys `BeatStreamVault` with MockUSDC address
3. Mints 1,000 USDC to the deployer for testing

---

## 🖥️ Backend Server (`packages/server/`)

A standalone Express + WebSocket server wired into the SE2 monorepo as a yarn workspace (`@beatstream/server`).

### Run it
```bash
# From repo root
yarn server:dev     # tsx watch mode on port 4000

# Endpoints
# REST:  http://localhost:4000
# WS:    ws://localhost:4000/ws/stream
# Health: GET /api/health
# Status: GET /api/status
```

### File-by-file breakdown

#### Config Layer
| File | What it does |
|------|-------------|
| `src/config/constants.ts` | All shared constants — beat rates, Yellow Network contract addresses (custody `0x019B...`, adjudicator `0x7c7c...`), Circle Arc USDC address (`0x3600...`), ENS domain (`beatstream.eth`), fan subdomain threshold (100s) |
| `src/config/types.ts` | TypeScript interfaces for `User`, `Artist`, `Track`, `Session`, all API request/response types, `StreamVoucher` |

#### Database Layer
| File | What it does |
|------|-------------|
| `src/db/schema.sql` | Full Supabase SQL schema: `users` (with role), `artists`, `tracks` (with `is_private`), `sessions` tables. Includes 4 RPC functions (`credit_beats`, `debit_beat`, `increment_session_payment`, `credit_artist_earnings`) and seed data (3 demo artists, 5 demo tracks) |
| `src/db/supabase.ts` | Supabase client + every DB helper: `getUser`, `createUser`, `creditBeats`, `debitBeat`, `getArtists`, `createArtist`, `creditArtistEarnings`, `getTracks`, `createTrack`, `createSession`, `getSession`, `incrementSessionPayment`, `settleSession` |

#### Utility
| File | What it does |
|------|-------------|
| `src/lib/verify.ts` | Wallet signature verification using viem's `verifyMessage`. Includes `buildStreamVoucherMessage()` and `buildAuthMessage()` for canonical message construction |

#### Services (Integration Layer)
| File | What it does |
|------|-------------|
| `src/services/yellow.ts` | **Yellow Network** integration via `@erc7824/nitrolite`. Connects to ClearNode sandbox WebSocket (`wss://clearnet-sandbox.yellow.com/ws`). Functions: `initYellow()`, `authenticateWithClearNode()` (EIP-712), `openChannel()`, `updateChannelState()` (shifts 1 beat user→server per second), `closeChannel()` |
| `src/services/arc.ts` | **Circle Arc** integration. `settlePayment()` calls Circle's Smart Contract Platform API to execute `BeatStreamVault.settle()` on-chain. `verifyDeposit()` confirms USDC deposit transactions. Gracefully simulates when API keys aren't set |
| `src/services/ens.ts` | **ENS** subdomain management. `generateArtistENS("SynthWave")` → `synthwave.beatstream.eth`. `checkFanSubdomainEligibility()` (≥100 seconds streamed). `generateFanSubdomain()` → `fan-abc123.synthwave.beatstream.eth`. `buildArtistENSMetadata()` for API responses |

#### API Routes
| Route | Methods | What it does |
|-------|---------|-------------|
| `src/routes/artists.ts` | `POST /api/artists/register`, `GET /api/artists`, `GET /api/artists/:id` | Artist registration with wallet signature verification, ENS subdomain auto-generation, role upgrade |
| `src/routes/users.ts` | `POST /api/users/register`, `GET /api/users/:wallet` | User registration/login with signature auth |
| `src/routes/deposit.ts` | `POST /api/deposit`, `POST /api/deposit/verify` | USDC deposit verification via Circle Arc → Beats credit (1 USDC = 1000 Beats) |
| `src/routes/tracks.ts` | `POST /api/tracks`, `GET /api/tracks`, `GET /api/tracks/:id` | Track upload (artists only, signature-gated), listing with `?artist_id=` filter |
| `src/routes/sessions.ts` | `POST /api/sessions/start`, `POST /api/sessions/settle`, `GET /api/sessions/:id` | Start session (opens Yellow channel), settle session (closes channel → Arc settlement → artist earnings → fan subdomain check) |
| `src/routes/stream.ws.ts` | WebSocket `/ws/stream` | Real-time streaming: `start_stream` → 1 beat/second tick loop → `beat_tick` events → `pause`/`resume`/`stop`. Deducts beats from user balance, updates Yellow channel state, tracks voucher signatures |

#### Entry Point
| File | What it does |
|------|-------------|
| `src/index.ts` | Express app + HTTP server + CORS + JSON parsing. Mounts all routes, initializes all services (Supabase, Arc, ENS, Yellow), attaches WebSocket server, starts on port 4000 |

### Streaming Flow (end-to-end)

```
Frontend                        Backend (REST)              Backend (WS)                Yellow Network
   │                                │                           │                           │
   │ POST /sessions/start ─────────▶│                           │                           │
   │   {wallet, trackId, sig}       │                           │                           │
   │                                │── openChannel() ─────────────────────────────────────▶│
   │                                │◀── channelId ────────────────────────────────────────│
   │◀── {session, channel} ────────│                           │                           │
   │                                │                           │                           │
   │ WS connect ───────────────────────────────────────────────▶│                           │
   │ {type:"start_stream"} ────────────────────────────────────▶│                           │
   │                                │                           │                           │
   │                             Every 1 second:                │                           │
   │◀── {type:"beat_tick"} ────────────────────────────────────│── debitBeat(user) ────────│
   │    beatsRemaining: 999         │                           │── updateChannelState() ──▶│
   │◀── {type:"beat_tick"} ────────────────────────────────────│                           │
   │    beatsRemaining: 998         │                           │                           │
   │        ...                     │                           │                           │
   │                                │                           │                           │
   │ {type:"stop_stream"} ─────────────────────────────────────▶│                           │
   │◀── {type:"stream_stopped"} ───────────────────────────────│                           │
   │                                │                           │                           │
   │ POST /sessions/settle ────────▶│                           │                           │
   │   {wallet, sessionId, sig}     │── closeChannel() ───────────────────────────────────▶│
   │                                │── settlePayment() (Arc) ──│                           │
   │                                │── creditArtistEarnings() ─│                           │
   │◀── {settlement, fanSubdomain}─│                           │                           │
```

---

## 🌐 Frontend Placeholders (`packages/nextjs/app/beatstream/`)

Minimal placeholder pages created for the Next.js app router:

| Route | File | Status |
|-------|------|--------|
| `/beatstream` | `page.tsx` | Landing page with 3-card grid (Yellow, Arc, ENS) |
| `/beatstream/artist/[id]` | `artist/[id]/page.tsx` | Placeholder |
| `/beatstream/stream/[trackId]` | `stream/[trackId]/page.tsx` | Placeholder |
| `/beatstream/deposit` | `deposit/page.tsx` | Placeholder |
| `/beatstream/dashboard` | `dashboard/page.tsx` | Placeholder |

---

## 🔧 Monorepo Wiring

- Root `package.json` → `workspaces` updated to include `packages/server`
- Scripts added: `yarn server:dev`, `yarn server:build`, `yarn server:start`
- `yarn install` from root installs all three workspaces
- Server package uses `tsx` for dev, `tsc` for build
- **TypeScript: compiles with 0 errors** ✅
- **Server: starts and responds to `/api/health`** ✅

---

## 📦 Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@erc7824/nitrolite` | ^0.2.0 | Yellow Network state channel SDK |
| `@supabase/supabase-js` | ^2.49.0 | Supabase PostgreSQL client |
| `viem` | ^2.21.0 | Ethereum interactions + signature verification |
| `express` | ^4.21.0 | REST API framework |
| `ws` | ^8.18.0 | WebSocket server for real-time streaming |
| `dotenv` | ^16.4.0 | Environment variable loading |
| `cors` | ^2.8.5 | Cross-origin support |

---

## 💰 Currency System

| Unit | Value | Usage |
|------|-------|-------|
| 1 USDC | 1,000 Beats | Deposit conversion rate |
| 1 Beat | 0.001 USDC | 1 second of streaming |
| 1 Chunk | 5 Beats | Audio delivery unit (5 seconds) |
| 100 Beats | Fan subdomain threshold | Qualifies fan for ENS subdomain |
