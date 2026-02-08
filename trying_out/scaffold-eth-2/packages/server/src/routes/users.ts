// ──────────────────────────────────────────────
// User Routes
// POST /api/users/register  – register new user
// GET  /api/users/:wallet   – get user info
// ──────────────────────────────────────────────
import { Router, type Request, type Response } from "express";
import { getUser, createUser } from "../db/supabase.js";
import { verifySig, buildAuthMessage } from "../lib/verify.js";

const router = Router();

/**
 * POST /api/users/register
 * Body: { wallet, signature, nonce }
 */
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { wallet, signature, nonce } = req.body;

    if (!wallet || !signature || nonce === undefined) {
      res.status(400).json({ error: "Missing required fields: wallet, signature, nonce" });
      return;
    }

    // Verify wallet ownership
    const message = buildAuthMessage(wallet, nonce);
    const valid = await verifySig(message, signature, wallet);
    if (!valid) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    // Create or fetch user
    const user = await createUser(wallet, "user");

    console.log(`👤 User registered/logged in: ${wallet}`);
    res.status(201).json({ user });
  } catch (err) {
    console.error("User registration error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * GET /api/users/:wallet
 */
router.get("/:wallet", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getUser(req.params.wallet as string);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
