// ──────────────────────────────────────────────
// Supabase Client + DB Helpers
// ──────────────────────────────────────────────
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { User, Artist, Track, Session, UserRole, FanSubdomain, StreamHistory } from "../config/types.js";

let supabase: SupabaseClient;

export function initSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || url === "your_supabase_url" || key === "your_supabase_service_role_key") {
    console.warn("⚠️  Supabase: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. DB calls will fail.");
    // Don't create a client — DB methods will throw helpful errors
    return;
  }

  supabase = createClient(url, key);
  console.log("✅ Supabase connected");
}

export function getSupabase() {
  return supabase;
}

// ═══════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════

export async function getUser(wallet: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("wallet_address", wallet.toLowerCase())
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function createUser(wallet: string, role: UserRole = "user", ensName?: string): Promise<User> {
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        wallet_address: wallet.toLowerCase(),
        role,
        ens_name: ensName ?? null,
      },
      { onConflict: "wallet_address" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function creditBeats(wallet: string, beats: number): Promise<number> {
  const { data, error } = await supabase.rpc("credit_beats", {
    p_wallet: wallet.toLowerCase(),
    p_beats: beats,
  });
  if (error) throw error;
  return data as number;
}

export async function debitBeat(wallet: string): Promise<number> {
  const { data, error } = await supabase.rpc("debit_beat", {
    p_wallet: wallet.toLowerCase(),
  });
  if (error) throw error;
  return data as number; // returns -1 if insufficient
}

// ═══════════════════════════════════════════════
// ARTISTS
// ═══════════════════════════════════════════════

export async function getArtists(): Promise<Artist[]> {
  const { data, error } = await supabase.from("artists").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function getArtist(artistId: string): Promise<Artist | null> {
  const { data, error } = await supabase
    .from("artists")
    .select("*")
    .eq("id", artistId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function getArtistByWallet(wallet: string): Promise<Artist | null> {
  const { data, error } = await supabase
    .from("artists")
    .select("*")
    .eq("wallet_address", wallet.toLowerCase())
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function createArtist(
  wallet: string,
  displayName: string,
  ensName: string
): Promise<Artist> {
  const { data, error } = await supabase
    .from("artists")
    .insert({
      wallet_address: wallet.toLowerCase(),
      ens_name: ensName,
      display_name: displayName,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function creditArtistEarnings(artistId: string, usdc: number): Promise<void> {
  const { error } = await supabase.rpc("credit_artist_earnings", {
    p_artist_id: artistId,
    p_usdc: usdc,
  });
  if (error) throw error;
}

// ═══════════════════════════════════════════════
// TRACKS
// ═══════════════════════════════════════════════

export async function getTracks(artistId?: string): Promise<Track[]> {
  let query = supabase.from("tracks").select("*");
  if (artistId) query = query.eq("artist_id", artistId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getTrack(trackId: string): Promise<Track | null> {
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("id", trackId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function createTrack(
  artistId: string,
  title: string,
  durationSeconds: number,
  isPrivate: boolean,
  audioUrl?: string,
  genre?: string
): Promise<Track> {
  const chunks = Math.ceil(durationSeconds / 5); // 5-second chunks
  const { data, error } = await supabase
    .from("tracks")
    .insert({
      artist_id: artistId,
      title,
      duration_seconds: durationSeconds,
      chunks,
      is_private: isPrivate,
      audio_url: audioUrl ?? null,
      genre: genre ?? "other",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTrackAudio(trackId: string, audioUrl: string): Promise<Track> {
  const { data, error } = await supabase
    .from("tracks")
    .update({ audio_url: audioUrl })
    .eq("id", trackId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════

export async function createSession(
  userWallet: string,
  artistId: string,
  trackId: string
): Promise<Session> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_wallet: userWallet.toLowerCase(),
      artist_id: artistId,
      track_id: trackId,
      status: "OPEN",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("session_id", sessionId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function incrementSessionPayment(
  sessionId: string,
  signature: string
): Promise<number> {
  const { data, error } = await supabase.rpc("increment_session_payment", {
    p_session_id: sessionId,
    p_signature: signature,
  });
  if (error) throw error;
  return data as number;
}

export async function settleSession(sessionId: string): Promise<Session> {
  const { data, error } = await supabase
    .from("sessions")
    .update({ status: "SETTLED" })
    .eq("session_id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════
// PLAY COUNTS & STREAM HISTORY
// ═══════════════════════════════════════════════

export async function incrementPlayCount(trackId: string): Promise<number> {
  const { data, error } = await supabase.rpc("increment_play_count", {
    p_track_id: trackId,
  });
  if (error) throw error;
  return data as number;
}

export async function incrementArtistStreams(artistId: string): Promise<number> {
  const { data, error } = await supabase.rpc("increment_artist_streams", {
    p_artist_id: artistId,
  });
  if (error) throw error;
  return data as number;
}

export async function recordStream(params: {
  wallet: string;
  artistId: string;
  trackId: string;
  sessionId: string;
  beats: number;
  duration: number;
}): Promise<void> {
  const { error } = await supabase.rpc("record_stream", {
    p_wallet: params.wallet.toLowerCase(),
    p_artist_id: params.artistId,
    p_track_id: params.trackId,
    p_session_id: params.sessionId,
    p_beats: params.beats,
    p_duration: params.duration,
  });
  if (error) throw error;
}

export async function getFanArtistBeats(wallet: string, artistId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_fan_artist_beats", {
    p_wallet: wallet.toLowerCase(),
    p_artist_id: artistId,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

// ═══════════════════════════════════════════════
// FAN SUBDOMAINS
// ═══════════════════════════════════════════════

export async function getFanSubdomain(
  fanWallet: string,
  artistId: string
): Promise<FanSubdomain | null> {
  const { data, error } = await supabase
    .from("fan_subdomains")
    .select("*")
    .eq("fan_wallet", fanWallet.toLowerCase())
    .eq("artist_id", artistId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function createFanSubdomain(params: {
  fanWallet: string;
  artistId: string;
  subdomain: string;
  totalBeatsStreamed: number;
  txHash?: string;
}): Promise<FanSubdomain> {
  const { data, error } = await supabase
    .from("fan_subdomains")
    .insert({
      fan_wallet: params.fanWallet.toLowerCase(),
      artist_id: params.artistId,
      subdomain: params.subdomain,
      total_beats_streamed: params.totalBeatsStreamed,
      tx_hash: params.txHash ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getFanSubdomains(fanWallet: string): Promise<FanSubdomain[]> {
  const { data, error } = await supabase
    .from("fan_subdomains")
    .select("*")
    .eq("fan_wallet", fanWallet.toLowerCase());
  if (error) throw error;
  return data ?? [];
}

// ═══════════════════════════════════════════════
// AUDIO FILE UPLOAD (Supabase Storage)
// ═══════════════════════════════════════════════

export async function uploadAudioFile(
  fileName: string,
  fileBuffer: Buffer,
  contentType: string = "audio/mpeg"
): Promise<string> {
  const filePath = `tracks/${Date.now()}_${fileName}`;

  const { error } = await supabase.storage
    .from("audio")
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (error) throw error;

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from("audio")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

// ═══════════════════════════════════════════════
// ARTIST UPDATES
// ═══════════════════════════════════════════════

export async function updateArtist(
  artistId: string,
  updates: { bio?: string; genre?: string; avatar_url?: string; ens_registered?: boolean }
): Promise<Artist> {
  const { data, error } = await supabase
    .from("artists")
    .update(updates)
    .eq("id", artistId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
