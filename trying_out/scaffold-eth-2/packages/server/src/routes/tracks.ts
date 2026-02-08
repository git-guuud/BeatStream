// ──────────────────────────────────────────────
// Track Routes
// POST /api/tracks         – upload a track (artist only)
// GET  /api/tracks         – list tracks (optional ?artist_id=)
// GET  /api/tracks/:id     – get single track
// ──────────────────────────────────────────────
import { Router, type Request, type Response } from "express";
import { getTracks, getTrack, createTrack, getArtistByWallet } from "../db/supabase.js";
import { verifySig, buildAuthMessage } from "../lib/verify.js";

const router = Router();

/**
 * POST /api/tracks
 * Body: { wallet, title, durationSeconds, isPrivate, signature, nonce }
 * Only artists can upload tracks.
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { wallet, title, durationSeconds, isPrivate, signature, nonce } = req.body;

    if (!wallet || !title || !durationSeconds || !signature || nonce === undefined) {
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

    // Check artist exists
    const artist = await getArtistByWallet(wallet);
    if (!artist) {
      res.status(403).json({ error: "Only registered artists can upload tracks" });
      return;
    }

    // Create track
    const track = await createTrack(artist.id, title, durationSeconds, isPrivate ?? true);

    console.log(`🎶 Track uploaded: "${title}" by ${artist.display_name}`);
    res.status(201).json({ track });
  } catch (err) {
    console.error("Track upload error:", err);
    res.status(500).json({ error: "Track upload failed" });
  }
});

/**
 * GET /api/tracks?artist_id=xxx
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const artistId = req.query.artist_id as string | undefined;
    const tracks = await getTracks(artistId);
    res.json({ tracks });
  } catch (err) {
    console.error("Get tracks error:", err);
    res.status(500).json({ error: "Failed to fetch tracks" });
  }
});

/**
 * GET /api/tracks/:id
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const track = await getTrack(req.params.id as string);
    if (!track) {
      res.status(404).json({ error: "Track not found" });
      return;
    }
    res.json({ track });
  } catch (err) {
    console.error("Get track error:", err);
    res.status(500).json({ error: "Failed to fetch track" });
  }
});

export default router;
