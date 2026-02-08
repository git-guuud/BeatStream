// ──────────────────────────────────────────────
// ENS Routes
// POST /api/ens/register-artist    – register artist subdomain on-chain
// POST /api/ens/mint-fan-subdomain – mint fan subdomain after 100+ beats
// GET  /api/ens/resolve/:name      – resolve an ENS name
// GET  /api/ens/check/:name        – check if subdomain is taken
// GET  /api/ens/fan-subdomains/:wallet – list fan's subdomains
// ──────────────────────────────────────────────
import { Router, type Request, type Response } from "express";
import { type Address } from "viem";
import { verifySig, buildAuthMessage } from "../lib/verify.js";
import {
  registerArtistSubdomain,
  mintFanSubdomain,
  isSubdomainRegistered,
  resolveENS,
  checkFanSubdomainEligibility,
  generateArtistENS,
  generateFanSubdomain,
  getENSText,
  setENSTextRecord,
} from "../services/ens.js";
import {
  getArtistByWallet,
  getArtist,
  updateArtist,
  getFanArtistBeats,
  getFanSubdomain,
  createFanSubdomain,
  getFanSubdomains,
} from "../db/supabase.js";

const router = Router();

/**
 * POST /api/ens/register-artist
 * Body: { wallet, signature, nonce }
 *
 * Registers <artistName>.beatstream.eth on-chain via NameWrapper.
 * The artist must already be registered in the DB.
 */
router.post(
  "/register-artist",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { wallet, signature, nonce } = req.body;

      if (!wallet || !signature || nonce === undefined) {
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
        res.status(404).json({ error: "Artist not found. Register as artist first." });
        return;
      }

      if (artist.ens_registered) {
        res.status(409).json({
          error: "ENS subdomain already registered",
          ensName: artist.ens_name,
        });
        return;
      }

      // Check if subdomain is already taken on-chain
      const alreadyTaken = await isSubdomainRegistered(artist.ens_name);
      if (alreadyTaken) {
        // Mark as registered in DB even if it was done externally
        await updateArtist(artist.id, { ens_registered: true });
        res.status(409).json({
          error: "Subdomain already exists on-chain",
          ensName: artist.ens_name,
        });
        return;
      }

      // Register on-chain
      const result = await registerArtistSubdomain(
        artist.display_name,
        wallet as Address
      );

      // Update DB
      await updateArtist(artist.id, { ens_registered: true });

      console.log(
        `🔗 ENS: Artist ${artist.display_name} → ${result.subdomain} (simulated: ${result.simulated})`
      );

      res.status(201).json({
        ensName: result.subdomain,
        txHash: result.txHash,
        simulated: result.simulated,
        artist: artist.id,
      });
    } catch (err) {
      console.error("ENS register-artist error:", err);
      res.status(500).json({ error: "ENS registration failed" });
    }
  }
);

/**
 * POST /api/ens/mint-fan-subdomain
 * Body: { wallet, artistId, signature, nonce }
 *
 * Mints fan-<walletPrefix>.<artist>.beatstream.eth if the fan
 * has streamed 100+ beats from this artist.
 */
router.post(
  "/mint-fan-subdomain",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { wallet, artistId, signature, nonce } = req.body;

      if (!wallet || !artistId || !signature || nonce === undefined) {
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
      const artist = await getArtist(artistId);
      if (!artist) {
        res.status(404).json({ error: "Artist not found" });
        return;
      }

      // Check if already minted
      const existing = await getFanSubdomain(wallet, artistId);
      if (existing) {
        res.status(409).json({
          error: "Fan subdomain already minted",
          subdomain: existing.subdomain,
        });
        return;
      }

      // Check eligibility — total beats streamed from this artist
      const totalBeats = await getFanArtistBeats(wallet, artistId);
      if (!checkFanSubdomainEligibility(totalBeats)) {
        res.status(403).json({
          error: "Not eligible yet",
          totalBeats,
          required: 100,
          remaining: Math.max(0, 100 - totalBeats),
        });
        return;
      }

      // Mint on-chain
      const result = await mintFanSubdomain(
        wallet as Address,
        artist.ens_name
      );

      // Save in DB
      const subdomain = await createFanSubdomain({
        fanWallet: wallet,
        artistId,
        subdomain: result.subdomain,
        totalBeatsStreamed: totalBeats,
        txHash: result.txHash ?? undefined,
      });

      console.log(
        `🏷️  ENS: Fan subdomain minted ${result.subdomain} (simulated: ${result.simulated})`
      );

      res.status(201).json({
        subdomain: result.subdomain,
        txHash: result.txHash,
        simulated: result.simulated,
        totalBeats,
        record: subdomain,
      });
    } catch (err) {
      console.error("ENS mint-fan-subdomain error:", err);
      res.status(500).json({ error: "Fan subdomain minting failed" });
    }
  }
);

/**
 * GET /api/ens/resolve/:name
 * Resolve an ENS name to an address.
 */
router.get(
  "/resolve/:name",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const name = req.params.name as string;
      const address = await resolveENS(name);

      if (!address) {
        res.status(404).json({ error: "Name not found", name });
        return;
      }

      res.json({ name, address });
    } catch (err) {
      console.error("ENS resolve error:", err);
      res.status(500).json({ error: "ENS resolution failed" });
    }
  }
);

/**
 * GET /api/ens/check/:name
 * Check if a subdomain is registered on-chain.
 */
router.get(
  "/check/:name",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const name = req.params.name as string;
      const registered = await isSubdomainRegistered(name);
      res.json({ name, registered });
    } catch (err) {
      console.error("ENS check error:", err);
      res.status(500).json({ error: "ENS check failed" });
    }
  }
);

/**
 * GET /api/ens/fan-subdomains/:wallet
 * List all fan subdomains for a wallet.
 */
router.get(
  "/fan-subdomains/:wallet",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const wallet = req.params.wallet as string;
      const subdomains = await getFanSubdomains(wallet);
      res.json({ wallet, subdomains });
    } catch (err) {
      console.error("Get fan subdomains error:", err);
      res.status(500).json({ error: "Failed to fetch fan subdomains" });
    }
  }
);

export default router;
