// ──────────────────────────────────────────────
// BeatStream Server — Entry Point
// Express REST API + WebSocket streaming
// ──────────────────────────────────────────────
import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";

// DB
import { initSupabase } from "./db/supabase.js";

// Services
import { initYellow } from "./services/yellow.js";
import { initArc } from "./services/arc.js";
import { initENS } from "./services/ens.js";

// Routes
import artistRoutes from "./routes/artists.js";
import userRoutes from "./routes/users.js";
import depositRoutes from "./routes/deposit.js";
import trackRoutes from "./routes/tracks.js";
import sessionRoutes from "./routes/sessions.js";
import ensRoutes from "./routes/ens.js";

// WebSocket
import { initWebSocketServer } from "./routes/stream.ws.js";

import { getYellowStatus } from "./services/yellow.js";
import { getArcStatus } from "./services/arc.js";
import { getENSStatus } from "./services/ens.js";

// ── Config ────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const app = express();
const server = http.createServer(app);

// ── Middleware ─────────────────────────────────

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(express.json());

// ── Health check ──────────────────────────────

app.get("/api/health", (_req: express.Request, res: express.Response) => {
  res.json({
    status: "ok",
    service: "BeatStream Server",
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────

app.use("/api/artists", artistRoutes);
app.use("/api/users", userRoutes);
app.use("/api/deposit", depositRoutes);
app.use("/api/tracks", trackRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/ens", ensRoutes);

// ── Status route ──────────────────────────────

app.get("/api/status", (_req: express.Request, res: express.Response) => {
  res.json({
    yellow: getYellowStatus(),
    arc: getArcStatus(),
    ens: getENSStatus(),
  });
});

// ── 404 handler ───────────────────────────────

app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Bootstrap ─────────────────────────────────

async function bootstrap() {
  console.log("🎵 BeatStream Server starting...\n");

  // Initialize services
  initSupabase();
  initArc();
  initENS();

  // Yellow needs async init (WebSocket)
  try {
    await initYellow();
  } catch (err) {
    console.error("Yellow init failed (non-fatal):", err);
  }

  // Initialize WebSocket server
  initWebSocketServer(server);

  // Start HTTP server
  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║  🎵  BeatStream Server                    ║
║  📡  REST API:  http://localhost:${PORT}     ║
║  🔌  WS:       ws://localhost:${PORT}/ws/stream ║
║  ❤️   Health:   http://localhost:${PORT}/api/health ║
╚═══════════════════════════════════════════╝
    `);
  });
}

bootstrap().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
