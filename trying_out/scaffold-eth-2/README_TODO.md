# 🔲 BeatStream — What Needs To Be Done

> Remaining work to go from "backend complete" to "hackathon-ready demo".

---

## 🔴 Critical Path (Must-Have for Demo)

### 1. Supabase Setup
- [ ] Create a Supabase project at [supabase.com](https://supabase.com)
- [ ] Run `packages/server/src/db/schema.sql` in the Supabase SQL Editor
- [ ] Copy project URL and service role key into `packages/server/.env`
- [ ] Verify seed data appears (3 artists, 5 tracks)

### 2. Smart Contract Deployment
- [ ] Configure `packages/hardhat/.env` with deployer private key + Alchemy/Infura RPC
- [ ] Run `yarn deploy --network sepolia` to deploy `MockUSDC` + `BeatStreamVault`
- [ ] Note deployed contract addresses for server `.env` (`VAULT_CONTRACT_ADDRESS`)
- [ ] Run the SE2 `yarn deploy` to generate ABIs into `packages/nextjs/contracts/deployedContracts.ts`

### 3. Circle Arc Setup
- [ ] Create a Circle developer account at [circle.com/developers](https://www.circle.com/developers)
- [ ] Generate API key and entity secret
- [ ] Create a developer-controlled wallet via Circle API
- [ ] Fund the wallet with testnet USDC from [faucet.circle.com](https://faucet.circle.com/)
- [ ] Fill in `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `CIRCLE_WALLET_ID` in `.env`
- [ ] Test deposit verification flow end-to-end

### 4. Yellow Network Setup
- [ ] Generate a Sepolia private key for the server's state channel wallet
- [ ] Fund it with Sepolia ETH (for gas)
- [ ] Deposit `ytest.usd` tokens into Yellow's Custody contract (`0x019B65A265EB3363822f2752141b3dF16131b262`)
- [ ] Fill in `YELLOW_PRIVATE_KEY` in `.env`
- [ ] Test ClearNode WebSocket authentication (EIP-712 challenge-response)
- [ ] Test channel open → update → close lifecycle
- [ ] **Important**: The current Yellow service uses a simplified channel flow. May need to adapt to the actual ClearNode RPC protocol (check [Yellow docs](https://docs.yellow.org/) for exact message formats)

### 5. ENS Registration
- [ ] Register `beatstream.eth` on ENS (mainnet or Sepolia testnet)
- [ ] Set up the NameWrapper to allow subdomain creation
- [ ] Implement on-chain subdomain minting (currently only generates the name string server-side)
- [ ] Wire up frontend to call ENS contracts for artist registration

---

## 🟡 Frontend (The Big Remaining Piece)

All pages under `packages/nextjs/app/beatstream/` are placeholder stubs. Here's what each needs:

### `/beatstream` — Landing Page
- [ ] Hero section with project branding
- [ ] "Connect Wallet" button (SE2's RainbowKit already available)
- [ ] Featured artists grid (fetch from `GET /api/artists`)
- [ ] Navigation to deposit, dashboard, artist pages
- [ ] Display user's Beats balance in the header

### `/beatstream/deposit` — Deposit USDC
- [ ] USDC amount input field
- [ ] "Approve + Deposit" button calling `BeatStreamVault.deposit()` via `useScaffoldWriteContract`
- [ ] Or: Circle Arc deposit flow (transfer USDC to vault via Circle's SDK)
- [ ] Show transaction status and confirmation
- [ ] After deposit, call `POST /api/deposit` to credit Beats
- [ ] Display updated Beats balance

### `/beatstream/artist/[id]` — Artist Profile
- [ ] Fetch artist data from `GET /api/artists/:id`
- [ ] Display ENS name, avatar (via `useEnsAvatar` with `chainId: 1`)
- [ ] Track listing from `GET /api/tracks?artist_id=:id`
- [ ] "Play" button on each track → navigates to stream page
- [ ] Artist earnings display (if viewing own profile)

### `/beatstream/stream/[trackId]` — Streaming Player (Core Feature)
- [ ] **Audio player UI** with play/pause/stop controls
- [ ] **WebSocket connection** to `ws://localhost:4000/ws/stream`
- [ ] On play: `POST /api/sessions/start` → get session + channel
- [ ] Send `{ type: "start_stream", sessionId, wallet }` over WS
- [ ] Listen for `beat_tick` events → update UI (seconds played, beats remaining)
- [ ] Handle `insufficient_beats` → show "deposit more" prompt
- [ ] On stop: send `{ type: "stop_stream" }` → call `POST /api/sessions/settle`
- [ ] Display settlement results (USDC paid, fan subdomain eligibility)
- [ ] **Audio chunk simulation**: Since we don't have actual audio files, simulate with a timer or use a royalty-free audio clip

### `/beatstream/dashboard` — Artist Dashboard
- [ ] Require connected wallet + artist role check
- [ ] **Track upload form**: title, duration, private toggle → `POST /api/tracks`
- [ ] **Earnings overview**: total USDC earned from `artist.usdc_earned`
- [ ] **Track management**: list own tracks, toggle `is_private`
- [ ] **ENS status**: display their `artist.beatstream.eth` name

### Shared Components to Build
- [ ] `BeatStreamHeader.tsx` — Beats balance display, navigation, connect wallet
- [ ] `TrackCard.tsx` — Reusable track listing component
- [ ] `ArtistCard.tsx` — Reusable artist card with ENS avatar
- [ ] `BeatsCounter.tsx` — Real-time animated beats counter (for stream page)
- [ ] `DepositModal.tsx` — Quick deposit flow without leaving the page

---

## 🟢 Nice-to-Have (If Time Permits)

### Audio Integration
- [ ] Add actual audio file storage (Supabase Storage or IPFS)
- [ ] Implement chunked audio delivery (5-second chunks, gated by beat payment)
- [ ] Add `audio_url` column to tracks table
- [ ] Stream audio via `<audio>` element with `MediaSource` API

### Yellow Network Deep Integration
- [ ] Implement proper EIP-712 challenge-response auth flow
- [ ] Session key management (generate ephemeral keys for streaming sessions)
- [ ] Real channel resize operations (allocate_amount) during streaming
- [ ] Proper channel finalization and on-chain withdrawal
- [ ] Handle ClearNode reconnection and channel recovery

### Circle Arc Deep Integration
- [ ] Implement webhook listener for deposit confirmations (instead of polling)
- [ ] Deploy `BeatStreamVault` via Circle's Smart Contract Platform API
- [ ] Use Circle's gas abstraction for user-friendly transactions
- [ ] Implement automated settlement cron job for ended sessions

### ENS Deep Integration
- [ ] On-chain subdomain minting via NameWrapper contract
- [ ] ENS avatar resolution on artist profiles (wagmi `useEnsAvatar`)
- [ ] ENS name resolution display throughout the UI (wagmi `useEnsName`)
- [ ] Fan subdomain minting ceremony (confetti + NFT-like display)
- [ ] Custom ENS resolver for beatstream.eth that returns streaming metadata

### Backend Hardening
- [ ] Rate limiting on API routes
- [ ] Proper JWT/session auth (instead of per-request signatures)
- [ ] Request validation middleware (zod schemas)
- [ ] Error handling middleware with consistent error format
- [ ] Logging with structured logger (pino/winston)
- [ ] Session timeout (auto-settle after X minutes of inactivity)
- [ ] Dispute resolution for state channel disagreements

### Testing
- [ ] Hardhat unit tests for `BeatStreamVault.sol` (deposit, settle, withdraw, edge cases)
- [ ] Server API integration tests (supertest)
- [ ] WebSocket stream flow tests
- [ ] Frontend E2E tests (Playwright)

### DevOps / Demo
- [ ] Docker Compose for local full-stack (hardhat node + server + frontend)
- [ ] Deploy contracts to Sepolia
- [ ] Deploy server to Railway/Fly.io
- [ ] Deploy frontend to Vercel
- [ ] Record a demo video showing the full streaming flow
- [ ] Prepare pitch deck with architecture diagrams

---

## 📋 Suggested Build Order

For fastest path to a working demo:

```
1. Supabase setup (30 min)
   └── Run schema.sql, fill .env

2. Contract deployment (30 min)
   └── yarn deploy --network sepolia

3. Landing page + Deposit page (2-3 hours)
   └── Connect wallet, deposit USDC, show Beats balance

4. Stream page with WebSocket (3-4 hours)
   └── This is THE demo — real-time beat counter ticking down

5. Artist profile + dashboard (2-3 hours)
   └── Upload tracks, view earnings

6. Yellow Network wiring (2-3 hours)
   └── Get state channels actually working with ClearNode

7. Circle Arc wiring (1-2 hours)
   └── Real deposit verification + settlement

8. ENS display (1-2 hours)
   └── Show artist.beatstream.eth names + avatars

9. Polish + demo recording (2-3 hours)
```

**Estimated total: ~15-20 hours of focused work for a demo-ready hackathon submission.**

---

## 🔑 Environment Variables Needed

```bash
# Supabase (REQUIRED)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Circle Arc (REQUIRED for real settlements)
CIRCLE_API_KEY=TEST_API_KEY:xxxxx
CIRCLE_ENTITY_SECRET=xxxxx
CIRCLE_WALLET_ID=xxxxx
VAULT_CONTRACT_ADDRESS=0x...

# Yellow Network (REQUIRED for state channels)
YELLOW_PRIVATE_KEY=0x...

# Hardhat (for deployment)
DEPLOYER_PRIVATE_KEY=0x...
ALCHEMY_API_KEY=xxxxx

# App
PORT=4000
CLIENT_URL=http://localhost:3000
```
