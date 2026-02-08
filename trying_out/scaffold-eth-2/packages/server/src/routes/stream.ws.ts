// ──────────────────────────────────────────────
// WebSocket Stream Handler
// Real-time beat-per-second deduction during playback
// ──────────────────────────────────────────────
import { WebSocketServer, type WebSocket as WS } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import {
  getSession,
  debitBeat,
  incrementSessionPayment,
} from "../db/supabase.js";
import { updateChannelState } from "../services/yellow.js";
import { verifySig, buildStreamVoucherMessage } from "../lib/verify.js";

interface ActiveStream {
  sessionId: string;
  wallet: string;
  channelId: string | null;
  interval: ReturnType<typeof setInterval> | null;
  secondsPlayed: number;
  totalBeatsPaid: number;
}

// Track active streams by WebSocket
const activeStreams = new Map<WS, ActiveStream>();

export function initWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/stream" });

  wss.on("connection", (ws: WS, req: IncomingMessage) => {
    console.log("🔌 WS client connected");

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        await handleStreamMessage(ws, msg);
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
      }
    });

    ws.on("close", () => {
      const stream = activeStreams.get(ws);
      if (stream?.interval) {
        clearInterval(stream.interval);
      }
      activeStreams.delete(ws);
      console.log("🔌 WS client disconnected");
    });
  });

  console.log("✅ WebSocket server initialized on /ws/stream");
  return wss;
}

async function handleStreamMessage(ws: WS, msg: Record<string, unknown>) {
  const type = msg.type as string;

  switch (type) {
    case "start_stream":
      await handleStartStream(ws, msg);
      break;

    case "heartbeat":
      await handleHeartbeat(ws, msg);
      break;

    case "pause_stream":
      handlePauseStream(ws);
      break;

    case "resume_stream":
      handleResumeStream(ws);
      break;

    case "stop_stream":
      handleStopStream(ws);
      break;

    default:
      ws.send(JSON.stringify({ type: "error", message: `Unknown type: ${type}` }));
  }
}

/**
 * Client sends: { type: "start_stream", sessionId, wallet, channelId? }
 * Server starts the per-second beat deduction loop.
 */
async function handleStartStream(ws: WS, msg: Record<string, unknown>) {
  const sessionId = msg.sessionId as string;
  const wallet = msg.wallet as string;
  const channelId = (msg.channelId as string) ?? null;

  if (!sessionId || !wallet) {
    ws.send(JSON.stringify({ type: "error", message: "Missing sessionId or wallet" }));
    return;
  }

  // Verify session exists and belongs to user
  const session = await getSession(sessionId);
  if (!session || session.user_wallet !== wallet.toLowerCase()) {
    ws.send(JSON.stringify({ type: "error", message: "Invalid session" }));
    return;
  }

  const stream: ActiveStream = {
    sessionId,
    wallet: wallet.toLowerCase(),
    channelId,
    interval: null,
    secondsPlayed: 0,
    totalBeatsPaid: session.total_beats_paid,
  };

  // Start the per-second tick
  stream.interval = setInterval(async () => {
    await tickBeat(ws, stream);
  }, 1000);

  activeStreams.set(ws, stream);

  ws.send(
    JSON.stringify({
      type: "stream_started",
      sessionId,
      beatsRate: 1, // 1 beat/second
    })
  );

  console.log(`▶️  WS: Stream started for session ${sessionId}`);
}

/**
 * Every second: debit 1 beat from user, update channel state
 */
async function tickBeat(ws: WS, stream: ActiveStream) {
  // Debit 1 beat from user
  const newBalance = await debitBeat(stream.wallet);

  if (newBalance < 0) {
    // Insufficient beats — stop stream
    ws.send(
      JSON.stringify({
        type: "insufficient_beats",
        secondsPlayed: stream.secondsPlayed,
        totalBeatsPaid: stream.totalBeatsPaid,
      })
    );

    // Auto-stop
    if (stream.interval) clearInterval(stream.interval);
    stream.interval = null;
    return;
  }

  stream.secondsPlayed += 1;
  stream.totalBeatsPaid += 1;

  // Record payment in session
  const signature = `auto_${Date.now()}`; // In production: client-signed voucher
  await incrementSessionPayment(stream.sessionId, signature);

  // Update Yellow channel state (shift 1 beat from user → server)
  if (stream.channelId) {
    await updateChannelState(
      stream.channelId,
      stream.wallet,
      newBalance,
      stream.totalBeatsPaid
    );
  }

  // Send tick to client
  ws.send(
    JSON.stringify({
      type: "beat_tick",
      secondsPlayed: stream.secondsPlayed,
      beatsRemaining: newBalance,
      totalBeatsPaid: stream.totalBeatsPaid,
    })
  );
}

/**
 * Client sends signed heartbeat voucher for proof of streaming
 */
async function handleHeartbeat(ws: WS, msg: Record<string, unknown>) {
  const stream = activeStreams.get(ws);
  if (!stream) {
    ws.send(JSON.stringify({ type: "error", message: "No active stream" }));
    return;
  }

  const signature = msg.signature as string;
  if (!signature) return;

  // Verify the voucher signature
  const voucherMsg = buildStreamVoucherMessage({
    sessionId: stream.sessionId,
    trackId: "", // Would come from session data
    secondsPlayed: stream.secondsPlayed,
    totalBeatsPaid: stream.totalBeatsPaid,
  });

  const valid = await verifySig(voucherMsg, signature, stream.wallet);
  if (valid) {
    await incrementSessionPayment(stream.sessionId, signature);
    ws.send(JSON.stringify({ type: "heartbeat_ack" }));
  }
}

function handlePauseStream(ws: WS) {
  const stream = activeStreams.get(ws);
  if (stream?.interval) {
    clearInterval(stream.interval);
    stream.interval = null;
    ws.send(JSON.stringify({ type: "stream_paused", secondsPlayed: stream.secondsPlayed }));
    console.log(`⏸️  WS: Stream paused for session ${stream.sessionId}`);
  }
}

function handleResumeStream(ws: WS) {
  const stream = activeStreams.get(ws);
  if (stream && !stream.interval) {
    stream.interval = setInterval(async () => {
      await tickBeat(ws, stream);
    }, 1000);
    ws.send(JSON.stringify({ type: "stream_resumed" }));
    console.log(`▶️  WS: Stream resumed for session ${stream.sessionId}`);
  }
}

function handleStopStream(ws: WS) {
  const stream = activeStreams.get(ws);
  if (stream) {
    if (stream.interval) clearInterval(stream.interval);
    ws.send(
      JSON.stringify({
        type: "stream_stopped",
        secondsPlayed: stream.secondsPlayed,
        totalBeatsPaid: stream.totalBeatsPaid,
      })
    );
    activeStreams.delete(ws);
    console.log(`⏹️  WS: Stream stopped for session ${stream.sessionId}`);
  }
}
