# 🎵 BeatStream

**Pay-per-second music streaming powered by Web3** — built on [Scaffold-ETH 2](https://scaffoldeth.io).

Stream music, pay by the second using on-chain Beats (1000 Beats = 1 USDC), and earn ENS subdomains as a loyal fan.

> 🏆 Hackathon submission targeting **Yellow Network** ($15k), **Circle Arc** ($10k), and **ENS** ($5k) bounties.

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

| Component | Tech | Status |
|-----------|------|--------|
| Smart Contracts | Solidity / Hardhat | ✅ Complete |
| Backend Server | Express + WebSocket + Supabase | ✅ Complete (0 TS errors) |
| Yellow Network | `@erc7824/nitrolite` — ClearNode state channels | ✅ Connected |
| Circle Arc | Smart Contract Platform + Dev Wallets | ✅ Integrated |
| ENS | On-chain subdomains via NameWrapper (Sepolia) | ✅ Complete |
| Frontend | Next.js (Scaffold-ETH 2) | 🔲 In progress |

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
# Terminal 3
cd packages/server
npx tsx src/index.ts
# Server starts on http://localhost:4000
```

### 5. Start Frontend

```bash
# Terminal 4
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

## 🔌 Integrations

### Yellow Network ($15k Prize)
- **`@erc7824/nitrolite`** SDK for state channels via ClearNode
- EIP-712 auth, app sessions, real-time state updates (1 beat/sec)
- Instant off-chain payments — no gas per stream second

### Circle Arc ($10k Prize)
- **Smart Contract Platform** for vault deployment + settlement
- **Developer Controlled Wallets** for server-side operations
- On-chain `settle()` converts Beats → USDC for artists

### ENS ($5k Prize)
- **NameWrapper** integration on Sepolia via viem
- Artist subdomains: `registerArtistSubdomain()` → on-chain
- Fan loyalty subdomains: `mintFanSubdomain()` → on-chain
- Text records: avatar, url, description
- Graceful simulation fallback for demo environments

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

## 📖 Documentation

- **[README_DONE.md](./README_DONE.md)** — Detailed technical breakdown of everything built
- **[README_TODO.md](./README_TODO.md)** — Remaining tasks and build order

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
