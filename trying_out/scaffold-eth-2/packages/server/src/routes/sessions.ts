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
  recordStream,
  incrementPlayCount,
  incrementArtistStreams,
  getFanArtistBeats,
  getFanSubdomain,
} from "../db/supabase.js";
import { verifySig, buildAuthMessage } from "../lib/verify.js";
import { openStreamSession, closeStreamSession } from "../services/yellow.js";
import { settlePayment } from "../services/arc.js";
import { checkFanSubdomainEligibility, generateFanSubdomain } from "../services/ens.js";
import { BEATS_PER_USDC, FAN_SUBDOMAIN_THRESHOLD } from "../config/constants.js";

const router = Router();

/**
 * POST /api/sessions/start
 * Body: { wallet, trackId, signature, nonce }
 *
 * Starts a streaming session:
 * 1. Verifies user has beats balance
 * 2. Opens a Yellow Network app session (state channel)
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

    // Create session in DB first (we need the session ID for Yellow)
    const session = await createSession(wallet, track.artist_id, trackId);

    // Open Yellow Network app session (state channel)
    const yellowSession = await openStreamSession(
      session.session_id,
      wallet,
      user.beats_balance
    );

    console.log(
      `▶️  Stream started: ${wallet} → track "${track.title}" (session: ${session.session_id})`
    );

    res.status(201).json({
      session,
      yellow: yellowSession
        ? { appSessionId: yellowSession.appSessionId }
        : { appSessionId: null, note: "Yellow session not available, using fallback" },
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
 * 1. Closes Yellow Network app session
 * 2. Settles payment via Circle Arc (vault.settle())
 * 3. Credits artist earnings in DB
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

    // 1. Close Yellow app session
    const user = await getUser(wallet);
    const userRemaining = user?.beats_balance ?? 0;
    await closeStreamSession(sessionId, wallet, userRemaining, totalBeats);

    // 2. Settle payment via Circle Arc (call vault.settle on-chain)
    const artist = await getArtist(session.artist_id);
    let settlement = null;
    if (artist && totalBeats > 0) {
      settlement = await settlePayment({
        totalBeats,
        artistWallet: artist.wallet_address,
        userWallet: wallet,
        sessionId,
      });

      // Credit artist earnings in DB
      if (settlement.success) {
        await creditArtistEarnings(session.artist_id, usdcAmount);
      }
    }

    // 3. Mark session as settled in DB
    const settled = await settleSession(sessionId);

    // 4. Record stream history + increment counters
    const track = await getTrack(session.track_id);
    if (artist && track && totalBeats > 0) {
      try {
        await recordStream({
          wallet,
          artistId: session.artist_id,
          trackId: session.track_id,
          sessionId,
          beats: totalBeats,
          duration: totalBeats, // 1 beat = 1 second
        });
        await incrementPlayCount(session.track_id);
        await incrementArtistStreams(session.artist_id);
      } catch (historyErr) {
        // Non-fatal — don't fail the settlement if history recording fails
        console.warn("⚠️  Stream history recording failed:", historyErr);
      }
    }

    // 5. Check fan subdomain eligibility (ENS integration)
    let fanSubdomain = null;
    let fanSubdomainEligible = false;
    if (artist) {
      const totalFanBeats = await getFanArtistBeats(wallet, session.artist_id);
      fanSubdomainEligible = checkFanSubdomainEligibility(totalFanBeats);

      // Check if they already have a subdomain
      const existingSub = await getFanSubdomain(wallet, session.artist_id);

      if (fanSubdomainEligible && !existingSub) {
        fanSubdomain = {
          name: generateFanSubdomain(wallet, artist.ens_name),
          eligible: true,
          totalBeatsFromArtist: totalFanBeats,
          threshold: FAN_SUBDOMAIN_THRESHOLD,
          hint: "Call POST /api/ens/mint-fan-subdomain to claim!",
        };
      } else if (existingSub) {
        fanSubdomain = {
          name: existingSub.subdomain,
          eligible: true,
          alreadyClaimed: true,
          totalBeatsFromArtist: totalFanBeats,
        };
      } else {
        fanSubdomain = {
          name: generateFanSubdomain(wallet, artist.ens_name),
          eligible: false,
          totalBeatsFromArtist: totalFanBeats,
          remaining: FAN_SUBDOMAIN_THRESHOLD - totalFanBeats,
        };
      }
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
