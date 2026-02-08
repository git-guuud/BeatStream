// ──────────────────────────────────────────────
// Track Routes
// POST /api/tracks         – upload a track (artist only)
// GET  /api/tracks         – list tracks (optional ?artist_id=)
// GET  /api/tracks/:id     – get single track
// POST /api/tracks/:id/audio – upload audio file for a track
// ──────────────────────────────────────────────
import { Router, type Request, type Response } from "express";
import express from "express";
import { getTracks, getTrack, createTrack, getArtistByWallet, updateTrackAudio, uploadAudioFile } from "../db/supabase.js";
import { verifySig, buildAuthMessage } from "../lib/verify.js";

const router = Router();

/**
 * POST /api/tracks
 * Body: { wallet, title, durationSeconds, isPrivate, genre, audioUrl, signature, nonce }
 * Only artists can upload tracks.
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { wallet, title, durationSeconds, isPrivate, genre, audioUrl, signature, nonce } = req.body;

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

    // Create track with optional genre and audioUrl
    const track = await createTrack(
      artist.id,
      title,
      durationSeconds,
      isPrivate ?? true,
      audioUrl,
      genre
    );

    console.log(`🎶 Track uploaded: "${title}" by ${artist.display_name}${genre ? ` [${genre}]` : ""}`);
    res.status(201).json({ track });
  } catch (err) {
    console.error("Track upload error:", err);
    res.status(500).json({ error: "Track upload failed" });
  }
});

/**
 * POST /api/tracks/:id/audio
 * Upload an audio file (raw body) for a track.
 * Headers: Content-Type: audio/mpeg (or audio/wav, etc.)
 *          X-Wallet: <wallet address>
 *          X-Signature: <signature>
 *          X-Nonce: <nonce>
 *          X-Filename: <original filename>
 */
router.post("/:id/audio", express.raw({ type: ["audio/*", "application/octet-stream"], limit: "50mb" }), async (req: Request, res: Response): Promise<void> => {
  try {
    const trackId = req.params.id as string;
    const wallet = req.headers["x-wallet"] as string;
    const signature = req.headers["x-signature"] as string;
    const nonce = req.headers["x-nonce"] as string;
    const fileName = (req.headers["x-filename"] as string) || `track_${trackId}.mp3`;

    if (!wallet || !signature || nonce === undefined) {
      res.status(400).json({ error: "Missing auth headers (X-Wallet, X-Signature, X-Nonce)" });
      return;
    }

    // Verify ownership
    const message = buildAuthMessage(wallet, parseInt(nonce, 10));
    const valid = await verifySig(message, signature, wallet);
    if (!valid) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    // Check track exists and belongs to artist
    const track = await getTrack(trackId);
    if (!track) {
      res.status(404).json({ error: "Track not found" });
      return;
    }

    const artist = await getArtistByWallet(wallet);
    if (!artist || artist.id !== track.artist_id) {
      res.status(403).json({ error: "Not your track" });
      return;
    }

    // Upload to Supabase Storage
    const contentType = (req.headers["content-type"] as string) || "audio/mpeg";
    const audioUrl = await uploadAudioFile(fileName, req.body as Buffer, contentType);

    // Update track record
    const updated = await updateTrackAudio(trackId, audioUrl);

    console.log(`🎵 Audio uploaded for track "${track.title}": ${audioUrl}`);
    res.json({ track: updated, audioUrl });
  } catch (err) {
    console.error("Audio upload error:", err);
    res.status(500).json({ error: "Audio upload failed" });
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
