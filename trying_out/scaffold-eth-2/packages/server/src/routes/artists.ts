// ──────────────────────────────────────────────
// Artist Routes
// POST /api/artists/register – register as artist
// GET  /api/artists          – list all artists
// GET  /api/artists/:id      – artist by ID
// ──────────────────────────────────────────────
import { Router, type Request, type Response } from "express";
import {
  getUser,
  createUser,
  getArtists,
  getArtist,
  getArtistByWallet,
  createArtist,
} from "../db/supabase.js";
import { generateArtistENS, isValidBeatStreamENS } from "../services/ens.js";
import { verifySig, buildAuthMessage } from "../lib/verify.js";

const router = Router();

/**
 * POST /api/artists/register
 * Body: { wallet, displayName, signature, nonce }
 */
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { wallet, displayName, signature, nonce } = req.body;

    if (!wallet || !displayName || !signature || nonce === undefined) {
      res.status(400).json({ error: "Missing required fields: wallet, displayName, signature, nonce" });
      return;
    }

    // Verify wallet ownership
    const message = buildAuthMessage(wallet, nonce);
    const valid = await verifySig(message, signature, wallet);
    if (!valid) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    // Check if already registered as artist
    const existing = await getArtistByWallet(wallet);
    if (existing) {
      res.status(409).json({ error: "Already registered as artist", artist: existing });
      return;
    }

    // Generate ENS subdomain
    const ensName = generateArtistENS(displayName);

    // Create/upgrade user to artist role
    await createUser(wallet, "artist", ensName);

    // Create artist record
    const artist = await createArtist(wallet, displayName, ensName);

    console.log(`🎵 New artist registered: ${displayName} → ${ensName}`);
    res.status(201).json({ artist, ensName });
  } catch (err) {
    console.error("Artist registration error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * GET /api/artists
 */
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const artists = await getArtists();
    res.json({ artists });
  } catch (err) {
    console.error("Get artists error:", err);
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});

/**
 * GET /api/artists/:id
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const artist = await getArtist(req.params.id as string);
    if (!artist) {
      res.status(404).json({ error: "Artist not found" });
      return;
    }
    res.json({ artist });
  } catch (err) {
    console.error("Get artist error:", err);
    res.status(500).json({ error: "Failed to fetch artist" });
  }
});

export default router;
