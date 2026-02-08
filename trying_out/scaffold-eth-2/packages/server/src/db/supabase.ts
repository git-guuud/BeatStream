// ──────────────────────────────────────────────
// Supabase Client + DB Helpers
// With in-memory fallback for demo/development
// ──────────────────────────────────────────────
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { User, Artist, Track, Session, UserRole, FanSubdomain, StreamHistory } from "../config/types.js";

let supabase: SupabaseClient | null = null;
let useMockData = false;

// In-memory mock storage for demo
const mockArtists: Map<string, Artist> = new Map();
const mockTracks: Map<string, Track> = new Map();
const mockUsers: Map<string, User> = new Map();

export function initSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || url === "your_supabase_url" || key === "your_supabase_service_role_key" || url === "your_supabase_project_url") {
    console.warn("⚠️  Supabase: Not configured. Using in-memory mock storage for demo.");
    useMockData = true;
    return;
  }

  supabase = createClient(url, key);
  console.log("✅ Supabase connected");
}

export function getSupabase() {
  return supabase;
}

// Helper to generate UUID
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ═══════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════

export async function getUser(wallet: string): Promise<User | null> {
  if (useMockData) {
    return mockUsers.get(wallet.toLowerCase()) || null;
  }
  const { data, error } = await supabase!
    .from("users")
    .select("*")
    .eq("wallet_address", wallet.toLowerCase())
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function createUser(wallet: string, role: UserRole = "user", ensName?: string): Promise<User> {
  if (useMockData) {
    const user: User = {
      wallet_address: wallet.toLowerCase(),
      role,
      beats_balance: 0,
      ens_name: ensName ?? null,
      created_at: new Date().toISOString(),
    };
    mockUsers.set(wallet.toLowerCase(), user);
    return user;
  }
  const { data, error } = await supabase!
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
  if (useMockData) {
    const user = mockUsers.get(wallet.toLowerCase());
    if (user) {
      user.beats_balance += beats;
      return user.beats_balance;
    }
    return 0;
  }
  const { data, error } = await supabase!.rpc("credit_beats", {
    p_wallet: wallet.toLowerCase(),
    p_beats: beats,
  });
  if (error) throw error;
  return data as number;
}

export async function debitBeat(wallet: string): Promise<number> {
  if (useMockData) {
    const user = mockUsers.get(wallet.toLowerCase());
    if (user && user.beats_balance > 0) {
      user.beats_balance -= 1;
      return user.beats_balance;
    }
    return -1;
  }
  const { data, error } = await supabase!.rpc("debit_beat", {
    p_wallet: wallet.toLowerCase(),
  });
  if (error) throw error;
  return data as number; // returns -1 if insufficient
}

// ═══════════════════════════════════════════════
// ARTISTS
// ═══════════════════════════════════════════════

export async function getArtists(): Promise<Artist[]> {
  if (useMockData) {
    return Array.from(mockArtists.values());
  }
  const { data, error } = await supabase!.from("artists").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function getArtist(artistId: string): Promise<Artist | null> {
  if (useMockData) {
    return mockArtists.get(artistId) || null;
  }
  const { data, error } = await supabase!
    .from("artists")
    .select("*")
    .eq("id", artistId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function getArtistByWallet(wallet: string): Promise<Artist | null> {
  if (useMockData) {
    for (const artist of mockArtists.values()) {
      if (artist.wallet_address === wallet.toLowerCase()) {
        return artist;
      }
    }
    return null;
  }
  const { data, error } = await supabase!
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
  if (useMockData) {
    const artist: Artist = {
      id: generateId(),
      wallet_address: wallet.toLowerCase(),
      ens_name: ensName,
      display_name: displayName,
      avatar_url: null,
      usdc_earned: 0,
      total_streams: 0,
      created_at: new Date().toISOString(),
    };
    mockArtists.set(artist.id, artist);
    console.log(`📝 Mock: Created artist ${displayName} (${artist.id})`);
    return artist;
  }
  const { data, error } = await supabase!
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
  if (useMockData) {
    const artist = mockArtists.get(artistId);
    if (artist) {
      artist.usdc_earned += usdc;
    }
    return;
  }
  const { error } = await supabase!.rpc("credit_artist_earnings", {
    p_artist_id: artistId,
    p_usdc: usdc,
  });
  if (error) throw error;
}

// ═══════════════════════════════════════════════
// TRACKS
// ═══════════════════════════════════════════════

export async function getTracks(artistId?: string): Promise<Track[]> {
  if (useMockData) {
    const tracks = Array.from(mockTracks.values());
    if (artistId) {
      return tracks.filter(t => t.artist_id === artistId);
    }
    return tracks;
  }
  let query = supabase!.from("tracks").select("*");
  if (artistId) query = query.eq("artist_id", artistId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getTrack(trackId: string): Promise<Track | null> {
  if (useMockData) {
    return mockTracks.get(trackId) || null;
  }
  const { data, error } = await supabase!
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
  if (useMockData) {
    const track: Track = {
      id: generateId(),
      artist_id: artistId,
      title,
      duration_seconds: durationSeconds,
      chunks,
      is_private: isPrivate,
      audio_url: audioUrl ?? null,
      cover_url: null,
      genre: genre ?? "other",
      play_count: 0,
      created_at: new Date().toISOString(),
    };
    mockTracks.set(track.id, track);
    console.log(`📝 Mock: Created track "${title}" (${track.id})`);
    return track;
  }
  const { data, error } = await supabase!
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
  if (useMockData) {
    const track = mockTracks.get(trackId);
    if (!track) throw new Error("Track not found");
    track.audio_url = audioUrl;
    return track;
  }
  const { data, error } = await supabase!
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
  if (useMockData) {
    // In mock mode, return a fake URL
    const mockUrl = `https://mock-storage.beatstream.local/audio/tracks/${Date.now()}_${fileName}`;
    console.log(`📝 Mock: Audio uploaded to ${mockUrl}`);
    return mockUrl;
  }

  const filePath = `tracks/${Date.now()}_${fileName}`;

  const { error } = await supabase!.storage
    .from("audio")
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (error) throw error;

  // Get the public URL
  const { data: urlData } = supabase!.storage
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
  if (useMockData) {
    const artist = mockArtists.get(artistId);
    if (!artist) throw new Error("Artist not found");
    Object.assign(artist, updates);
    return artist;
  }
  const { data, error } = await supabase!
    .from("artists")
    .update(updates)
    .eq("id", artistId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
