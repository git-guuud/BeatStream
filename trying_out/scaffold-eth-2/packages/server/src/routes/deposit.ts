// ──────────────────────────────────────────────
// Deposit Routes
// POST /api/deposit – deposit USDC → get Beats
// POST /api/deposit/verify – verify a deposit tx
// ──────────────────────────────────────────────
import { Router, type Request, type Response } from "express";
import { getUser, creditBeats } from "../db/supabase.js";
import { verifyDeposit } from "../services/arc.js";
import { verifySig, buildAuthMessage } from "../lib/verify.js";
import { BEATS_PER_USDC } from "../config/constants.js";

const router = Router();

/**
 * POST /api/deposit
 * Body: { wallet, txHash, signature, nonce }
 *
 * After user deposits USDC via Circle Arc on the frontend,
 * they send the txHash here. The server verifies the deposit
 * and credits beats to the user.
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { wallet, txHash, signature, nonce } = req.body;

    if (!wallet || !txHash || !signature || nonce === undefined) {
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

    // Check user exists
    const user = await getUser(wallet);
    if (!user) {
      res.status(404).json({ error: "User not found. Register first." });
      return;
    }

    // Verify deposit via Circle Arc
    const deposit = await verifyDeposit(txHash);
    if (!deposit.verified || !deposit.amount) {
      res.status(400).json({ error: "Deposit not verified or still pending" });
      return;
    }

    // Calculate beats: 1 USDC = 1000 beats
    const beatsToCredit = Math.floor(deposit.amount * BEATS_PER_USDC);

    // Credit beats to user
    const newBalance = await creditBeats(wallet, beatsToCredit);

    console.log(`💎 Deposit: ${wallet} → ${deposit.amount} USDC → ${beatsToCredit} beats`);

    res.json({
      success: true,
      deposited: deposit.amount,
      beatsCredit: beatsToCredit,
      newBalance,
    });
  } catch (err) {
    console.error("Deposit error:", err);
    res.status(500).json({ error: "Deposit processing failed" });
  }
});

/**
 * POST /api/deposit/verify
 * Body: { txHash }
 * Quick check if a tx has been confirmed (no auth needed)
 */
router.post("/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const { txHash } = req.body;
    if (!txHash) {
      res.status(400).json({ error: "Missing txHash" });
      return;
    }

    const deposit = await verifyDeposit(txHash);
    res.json(deposit);
  } catch (err) {
    console.error("Verify deposit error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

/**
 * POST /api/deposit/dev-faucet
 * Body: { wallet, beats, signature, nonce }
 *
 * DEV ONLY — credit free beats for testing.
 * Only available when NODE_ENV !== "production".
 */
router.post("/dev-faucet", async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Not available in production" });
    return;
  }
  try {
    const { wallet, beats, signature, nonce } = req.body;
    if (!wallet || !beats || !signature || nonce === undefined) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const message = buildAuthMessage(wallet, nonce);
    const valid = await verifySig(message, signature, wallet);
    if (!valid) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    const user = await getUser(wallet);
    if (!user) {
      res.status(404).json({ error: "User not found. Register first." });
      return;
    }

    const newBalance = await creditBeats(wallet, beats);
    console.log(`🧪 Dev faucet: ${wallet} → +${beats} beats (balance: ${newBalance})`);
    res.json({ success: true, beatsCredit: beats, newBalance });
  } catch (err) {
    console.error("Dev faucet error:", err);
    res.status(500).json({ error: "Dev faucet failed" });
  }
});

export default router;
