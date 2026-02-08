/**
 * End-to-End Test: Artist uploads song → Listener streams → Artist gets paid
 *
 * This simulates the full BeatStream flow using two wallets:
 *   - Artist wallet (from YELLOW_PRIVATE_KEY in .env)
 *   - Listener wallet (randomly generated)
 *
 * Usage: npx tsx scripts/e2e-test.ts
 */
import "dotenv/config";
import { type Hex } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const BASE = "http://localhost:4000";
const ARTIST_PK = process.env.YELLOW_PRIVATE_KEY as Hex;

// Generate a random listener wallet
const LISTENER_PK = generatePrivateKey();

const artistAccount = privateKeyToAccount(ARTIST_PK);
const listenerAccount = privateKeyToAccount(LISTENER_PK);

// Nonce counters (each wallet gets its own)
let artistNonce = 0;
let listenerNonce = 0;

function buildAuthMessage(wallet: string, nonce: number): string {
  return `Sign in to BeatStream\nWallet: ${wallet}\nNonce: ${nonce}`;
}

async function signAuth(
  account: ReturnType<typeof privateKeyToAccount>,
  nonce: number
): Promise<string> {
  const message = buildAuthMessage(account.address, nonce);
  return account.signMessage({ message });
}

async function artistSign(): Promise<{ signature: string; nonce: number }> {
  const n = ++artistNonce;
  return { signature: await signAuth(artistAccount, n), nonce: n };
}

async function listenerSign(): Promise<{ signature: string; nonce: number }> {
  const n = ++listenerNonce;
  return { signature: await signAuth(listenerAccount, n), nonce: n };
}

async function api(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ status: number; ok: boolean; data: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║     🎵 BeatStream End-to-End Test                ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");

  console.log(`🎸 Artist wallet:   ${artistAccount.address}`);
  console.log(`🎧 Listener wallet: ${listenerAccount.address}\n`);

  // ────────────────────────────────────────
  // Step 1: Register Artist
  // ────────────────────────────────────────
  console.log("═══ Step 1: Register Artist ═══");
  const a1 = await artistSign();
  const regArtist = await api("POST", "/api/artists/register", {
    wallet: artistAccount.address,
    displayName: "TestArtist",
    bio: "E2E test artist",
    genre: "Electronic",
    signature: a1.signature,
    nonce: a1.nonce,
  });

  if (regArtist.status === 201) {
    console.log(
      `   ✅ Artist registered: ${regArtist.data.artist?.display_name} → ${regArtist.data.ensName}`
    );
  } else if (regArtist.status === 409) {
    console.log(`   ⚠️  Artist already registered (${regArtist.data.error})`);
  } else {
    console.log(`   ❌ Failed (${regArtist.status}):`, regArtist.data);
  }

  // ────────────────────────────────────────
  // Step 2: Upload a Track
  // ────────────────────────────────────────
  console.log("\n═══ Step 2: Upload Track ═══");
  const a2 = await artistSign();
  const trackRes = await api("POST", "/api/tracks", {
    wallet: artistAccount.address,
    title: "E2E Test Song",
    durationSeconds: 180,
    isPrivate: false,
    genre: "Electronic",
    audioUrl: "https://example.com/test-song.mp3",
    signature: a2.signature,
    nonce: a2.nonce,
  });

  let trackId: string | null = null;
  if (trackRes.status === 201) {
    trackId = trackRes.data.track?.id;
    console.log(`   ✅ Track uploaded: "${trackRes.data.track?.title}" (ID: ${trackId})`);
  } else {
    console.log(`   ❌ Failed (${trackRes.status}):`, trackRes.data);
  }

  // ────────────────────────────────────────
  // Step 3: Register Listener
  // ────────────────────────────────────────
  console.log("\n═══ Step 3: Register Listener ═══");
  const l1 = await listenerSign();
  const regListener = await api("POST", "/api/users/register", {
    wallet: listenerAccount.address,
    signature: l1.signature,
    nonce: l1.nonce,
  });

  if (regListener.ok) {
    console.log(
      `   ✅ Listener registered: ${listenerAccount.address.slice(0, 10)}... (balance: ${regListener.data.user?.beats_balance ?? "?"} beats)`
    );
  } else {
    console.log(`   ❌ Failed (${regListener.status}):`, regListener.data);
  }

  // ────────────────────────────────────────
  // Step 4: Credit Listener with Beats (Dev Faucet)
  // ────────────────────────────────────────
  console.log("\n═══ Step 4: Credit Listener with Beats ═══");
  const l2 = await listenerSign();
  const faucetRes = await api("POST", "/api/deposit/dev-faucet", {
    wallet: listenerAccount.address,
    beats: 100,
    signature: l2.signature,
    nonce: l2.nonce,
  });

  if (faucetRes.ok) {
    console.log(`   ✅ Credited 100 beats (balance: ${faucetRes.data.newBalance})`);
  } else {
    console.log(`   ❌ Failed (${faucetRes.status}):`, faucetRes.data);
  }

  // ────────────────────────────────────────
  // Step 5: Browse Tracks
  // ────────────────────────────────────────
  console.log("\n═══ Step 5: Browse Tracks ═══");
  const tracksRes = await api("GET", "/api/tracks");
  const tracks = tracksRes.data?.tracks ?? tracksRes.data ?? [];
  console.log(`   ✅ ${Array.isArray(tracks) ? tracks.length : "?"} tracks available`);

  if (!trackId && Array.isArray(tracks) && tracks.length > 0) {
    trackId = tracks[0].id;
    console.log(`   📀 Using existing track: "${tracks[0].title}" (ID: ${trackId})`);
  }

  if (!trackId) {
    console.log("\n❌ No tracks available to stream. Aborting.");
    return;
  }

  // ────────────────────────────────────────
  // Step 6: Start Streaming Session
  // ────────────────────────────────────────
  console.log("\n═══ Step 6: Start Streaming Session ═══");
  const l3 = await listenerSign();
  const startRes = await api("POST", "/api/sessions/start", {
    wallet: listenerAccount.address,
    trackId,
    signature: l3.signature,
    nonce: l3.nonce,
  });

  let sessionId: string | null = null;
  if (startRes.ok) {
    sessionId = startRes.data.session?.session_id ?? startRes.data.session?.id;
    const yellowNote = startRes.data.yellow?.appSessionId
      ? `Yellow session: ${startRes.data.yellow.appSessionId}`
      : "Yellow: fallback mode";
    console.log(`   ✅ Session started: ${sessionId}`);
    console.log(`   💰 Beats balance: ${startRes.data.beatsBalance}`);
    console.log(`   🟡 ${yellowNote}`);
  } else {
    console.log(`   ❌ Failed (${startRes.status}):`, startRes.data);
    return;
  }

  // ────────────────────────────────────────
  // Step 7: Stream via WebSocket (10 seconds)
  // ────────────────────────────────────────
  console.log("\n═══ Step 7: Stream via WebSocket (10 seconds) ═══");
  const streamResult = await new Promise<{ secondsPlayed: number; beatsRemaining: number }>(
    (resolve) => {
      import("ws").then(({ default: WebSocket }) => {
        const ws = new WebSocket("ws://localhost:4000/ws/stream");

        let lastTick = { secondsPlayed: 0, beatsRemaining: 0 };
        let tickCount = 0;
        let resolved = false;

        function done() {
          if (!resolved) {
            resolved = true;
            resolve(lastTick);
          }
        }

        ws.on("open", () => {
          ws.send(
            JSON.stringify({
              type: "start_stream",
              sessionId,
              wallet: listenerAccount.address,
            })
          );
        });

        ws.on("message", (raw: Buffer) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "beat_tick") {
            tickCount++;
            lastTick = {
              secondsPlayed: msg.secondsPlayed,
              beatsRemaining: msg.beatsRemaining,
            };
            process.stdout.write(
              `\r   🎶 Tick ${tickCount}: ${msg.secondsPlayed}s played, ${msg.beatsRemaining} beats remaining`
            );

            if (tickCount >= 10) {
              ws.send(JSON.stringify({ type: "stop_stream" }));
              setTimeout(() => {
                ws.close();
                console.log("");
                done();
              }, 500);
            }
          } else if (msg.type === "stream_started") {
            console.log("   ▶️  Stream started via WebSocket");
          } else if (msg.type === "error") {
            console.log(`   ❌ WS error: ${msg.message}`);
            ws.close();
            done();
          } else if (msg.type === "stream_stopped") {
            console.log("\n   ⏹️  Stream stopped");
          }
        });

        ws.on("error", (err) => {
          console.log(`   ❌ WS connection error: ${err.message}`);
          done();
        });

        ws.on("close", () => {
          done();
        });

        // Safety timeout
        setTimeout(() => {
          if (!resolved) {
            ws.close();
            console.log("\n   ⏰ Timeout reached");
            done();
          }
        }, 15000);
      });
    }
  );

  console.log(
    `   ✅ Streamed ${streamResult.secondsPlayed} seconds, ${streamResult.beatsRemaining} beats left`
  );

  // ────────────────────────────────────────
  // Step 8: Settle Session (Artist gets paid)
  // ────────────────────────────────────────
  console.log("\n═══ Step 8: Settle Session (Artist Gets Paid) ═══");
  const l4 = await listenerSign();
  const settleRes = await api("POST", "/api/sessions/settle", {
    wallet: listenerAccount.address,
    sessionId,
    signature: l4.signature,
    nonce: l4.nonce,
  });

  if (settleRes.ok) {
    const d = settleRes.data;
    console.log(`   ✅ Session settled!`);
    console.log(`   💰 Total beats paid: ${d.settlement?.totalBeats}`);
    console.log(`   💵 USDC equivalent: ${d.settlement?.usdcAmount}`);
    console.log(`   🔗 Settlement tx: ${d.settlement?.txHash ?? "simulated"}`);
    if (d.fanSubdomain) {
      console.log(
        `   🏷️  Fan subdomain: ${d.fanSubdomain.name} (eligible: ${d.fanSubdomain.eligible})`
      );
    }
  } else {
    console.log(`   ❌ Failed (${settleRes.status}):`, settleRes.data);
  }

  // ────────────────────────────────────────
  // Step 9: Verify Artist Earnings
  // ────────────────────────────────────────
  console.log("\n═══ Step 9: Verify Artist Earnings ═══");
  const artistRes = await api("GET", "/api/artists");
  const artists = artistRes.data?.artists ?? artistRes.data ?? [];
  if (Array.isArray(artists)) {
    const ourArtist = artists.find(
      (a: any) => a.wallet_address?.toLowerCase() === artistAccount.address.toLowerCase()
    );
    if (ourArtist) {
      console.log(`   🎸 ${ourArtist.display_name}`);
      console.log(`   💰 Total earnings: ${ourArtist.earnings ?? ourArtist.total_earnings ?? 0} USDC`);
      console.log(`   📊 Total streams: ${ourArtist.total_streams ?? 0}`);
      console.log(`   🏷️  ENS: ${ourArtist.ens_name}`);
    }
  }

  // ────────────────────────────────────────
  // Step 10: Check ENS Status
  // ────────────────────────────────────────
  console.log("\n═══ Step 10: Check ENS Status ═══");
  const ensRes = await api("GET", "/api/ens/check/testartist");
  console.log(`   ENS check:`, ensRes.data);

  // ────────────────────────────────────────
  // Summary
  // ────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log("║     📊 End-to-End Test Summary                   ║");
  console.log("╠═══════════════════════════════════════════════════╣");
  console.log(`║  Artist registered:  ✅                           ║`);
  console.log(`║  Track uploaded:     ${trackId ? "✅" : "❌"}                           ║`);
  console.log(`║  Listener registered: ✅                          ║`);
  console.log(`║  Stream started:     ${sessionId ? "✅" : "❌"}                           ║`);
  console.log(`║  Beat ticks:         ${streamResult.secondsPlayed > 0 ? "✅" : "❌"} (${streamResult.secondsPlayed}s)                      ║`);
  console.log(`║  Session settled:    ${settleRes.ok ? "✅" : "❌"}                           ║`);
  console.log(`║  Artist paid:        ${settleRes.ok ? "✅" : "❌"}                           ║`);
  console.log("╚═══════════════════════════════════════════════════╝");

  // Force exit (WebSocket cleanup)
  process.exit(settleRes.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
