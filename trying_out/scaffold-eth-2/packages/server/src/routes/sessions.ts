// ──────────────────────────────────────────────
// Session Routes
// POST /api/sessions/start   – start a streaming session
// POST /api/sessions/settle  – end & settle a session
// GET  /api/sessions/:id     – get session info
// ──────────────────────────────────────────────
import { Router, type Request, type Response } from "express";
import {
  getUser,
  getTrack,
  getArtist,
  createSession,
  getSession,
  settleSession,
  creditArtistEarnings,
} from "../db/supabase.js";
import { verifySig, buildAuthMessage } from "../lib/verify.js";
import { openChannel, closeChannel } from "../services/yellow.js";
import { settlePayment } from "../services/arc.js";
import { checkFanSubdomainEligibility, generateFanSubdomain } from "../services/ens.js";
import { BEATS_PER_USDC } from "../config/constants.js";

const router = Router();

/**
 * POST /api/sessions/start
 * Body: { wallet, trackId, signature, nonce }
 *
 * Starts a streaming session:
 * 1. Verifies user has beats balance
 * 2. Opens a Yellow Network state channel
 * 3. Creates session in DB
 */
router.post("/start", async (req: Request, res: Response): Promise<void> => {
  try {
    const { wallet, trackId, signature, nonce } = req.body;

    if (!wallet || !trackId || !signature || nonce === undefined) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Verify wallet ownership
    const message = buildAuthMessage(wallet, nonce);
    const valid = await verifySig(message, signature, wallet);
    if (!valid) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    // Check user exists and has beats
    const user = await getUser(wallet);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (user.beats_balance <= 0) {
      res.status(402).json({ error: "Insufficient beats. Deposit USDC first." });
      return;
    }

    // Check track exists
    const track = await getTrack(trackId);
    if (!track) {
      res.status(404).json({ error: "Track not found" });
      return;
    }

    // Open Yellow Network state channel
    const channel = await openChannel(wallet, user.beats_balance);

    // Create session in DB
    const session = await createSession(wallet, track.artist_id, trackId);

    console.log(
      `▶️  Stream started: ${wallet} → track "${track.title}" (session: ${session.session_id})`
    );

    res.status(201).json({
      session,
      channel: channel
        ? { channelId: channel.channelId }
        : { channelId: null, note: "Yellow channel not available, using fallback" },
      beatsBalance: user.beats_balance,
    });
  } catch (err) {
    console.error("Session start error:", err);
    res.status(500).json({ error: "Failed to start session" });
  }
});

/**
 * POST /api/sessions/settle
 * Body: { wallet, sessionId, signature, nonce }
 *
 * Ends a streaming session:
 * 1. Closes Yellow Network state channel
 * 2. Settles payment via Circle Arc
 * 3. Credits artist earnings
 * 4. Checks fan subdomain eligibility
 */
router.post("/settle", async (req: Request, res: Response): Promise<void> => {
  try {
    const { wallet, sessionId, signature, nonce } = req.body;

    if (!wallet || !sessionId || !signature || nonce === undefined) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Verify wallet ownership
    const message = buildAuthMessage(wallet, nonce);
    const valid = await verifySig(message, signature, wallet);
    if (!valid) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    // Get session
    const session = await getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (session.status !== "OPEN") {
      res.status(400).json({ error: "Session already settled" });
      return;
    }
    if (session.user_wallet !== wallet.toLowerCase()) {
      res.status(403).json({ error: "Not your session" });
      return;
    }

    const totalBeats = session.total_beats_paid;
    const usdcAmount = totalBeats / BEATS_PER_USDC;

    // Close Yellow channel (if active)
    await closeChannel(`ch-${sessionId}`);

    // Settle payment via Circle Arc
    const artist = await getArtist(session.artist_id);
    let settlement = null;
    if (artist && totalBeats > 0) {
      settlement = await settlePayment({
        totalBeats,
        artistWallet: artist.wallet_address,
        sessionId,
      });

      // Credit artist earnings in DB
      if (settlement.success) {
        await creditArtistEarnings(session.artist_id, usdcAmount);
      }
    }

    // Mark session as settled
    const settled = await settleSession(sessionId);

    // Check fan subdomain eligibility
    let fanSubdomain = null;
    if (artist && checkFanSubdomainEligibility(totalBeats)) {
      fanSubdomain = generateFanSubdomain(wallet, artist.ens_name);
    }

    console.log(
      `⏹️  Session settled: ${sessionId}, ${totalBeats} beats → ${usdcAmount} USDC`
    );

    res.json({
      session: settled,
      settlement: {
        totalBeats,
        usdcAmount,
        txHash: settlement?.txHash ?? null,
      },
      fanSubdomain,
    });
  } catch (err) {
    console.error("Session settle error:", err);
    res.status(500).json({ error: "Failed to settle session" });
  }
});

/**
 * GET /api/sessions/:id
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const session = await getSession(req.params.id as string);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ session });
  } catch (err) {
    console.error("Get session error:", err);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

export default router;
