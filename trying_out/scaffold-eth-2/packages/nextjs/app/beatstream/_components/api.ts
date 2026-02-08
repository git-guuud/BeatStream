// API service to connect frontend with BeatStream server

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Types matching the database schema
export interface Artist {
  id: string;
  wallet_address: string;
  ens_name: string;
  display_name: string;
  avatar_url: string | null;
  usdc_earned: number;
  created_at: string;
}

export interface Track {
  id: string;
  artist_id: string;
  title: string;
  duration_seconds: number;
  chunks: number;
  cover_url: string | null;
  is_private: boolean;
  created_at: string;
  // Joined fields (from API)
  artist?: Artist;
}

export interface User {
  wallet_address: string;
  role: "user" | "artist";
  beats_balance: number;
  ens_name: string | null;
  created_at: string;
}

// Fetch all artists
export async function fetchArtists(): Promise<Artist[]> {
  const res = await fetch(`${API_BASE_URL}/api/artists`);
  if (!res.ok) throw new Error("Failed to fetch artists");
  const data = await res.json();
  return data.artists || [];
}

// Fetch single artist by ID
export async function fetchArtist(id: string): Promise<Artist | null> {
  const res = await fetch(`${API_BASE_URL}/api/artists/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.artist || null;
}

// Fetch tracks (optionally by artist)
export async function fetchTracks(artistId?: string): Promise<Track[]> {
  const url = artistId 
    ? `${API_BASE_URL}/api/tracks?artist_id=${artistId}`
    : `${API_BASE_URL}/api/tracks`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch tracks");
  const data = await res.json();
  return data.tracks || [];
}

// Fetch single track by ID
export async function fetchTrack(id: string): Promise<Track | null> {
  const res = await fetch(`${API_BASE_URL}/api/tracks/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.track || null;
}

// Fetch user by wallet address
export async function fetchUser(wallet: string): Promise<User | null> {
  const res = await fetch(`${API_BASE_URL}/api/users/${wallet}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.user || null;
}

// Check server health
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// Format duration helper
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Generate avatar emoji based on name (for artists without avatar_url)
export function getAvatarEmoji(name: string): string {
  const emojis = ["🎵", "🎶", "🎤", "🎸", "🎹", "🎺", "🎻", "🥁", "🎧", "🎼"];
  const index = name.charCodeAt(0) % emojis.length;
  return emojis[index];
}

// ═══════════════════════════════════════════════
// ARTIST DASHBOARD APIs
// ═══════════════════════════════════════════════

// Fetch artist by wallet address
export async function fetchArtistByWallet(wallet: string): Promise<Artist | null> {
  const res = await fetch(`${API_BASE_URL}/api/artists/wallet/${wallet}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.artist || null;
}

// Register as an artist
export async function registerArtist(
  wallet: string,
  displayName: string,
  signature: string,
  nonce: number,
  bio?: string,
  genre?: string
): Promise<{ artist: Artist; ensName: string }> {
  const res = await fetch(`${API_BASE_URL}/api/artists/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, displayName, bio, genre, signature, nonce }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Registration failed");
  }
  return res.json();
}

// Upload a new track
export async function uploadTrack(
  wallet: string,
  title: string,
  durationSeconds: number,
  signature: string,
  nonce: number,
  genre?: string,
  isPrivate?: boolean
): Promise<Track> {
  const res = await fetch(`${API_BASE_URL}/api/tracks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet,
      title,
      durationSeconds,
      isPrivate: isPrivate ?? false,
      genre,
      signature,
      nonce,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Track upload failed");
  }
  const data = await res.json();
  return data.track;
}

// Upload audio file for a track
export async function uploadTrackAudio(
  trackId: string,
  wallet: string,
  signature: string,
  nonce: number,
  audioFile: File
): Promise<{ track: Track; audioUrl: string }> {
  const res = await fetch(`${API_BASE_URL}/api/tracks/${trackId}/audio`, {
    method: "POST",
    headers: {
      "Content-Type": audioFile.type || "audio/mpeg",
      "X-Wallet": wallet,
      "X-Signature": signature,
      "X-Nonce": nonce.toString(),
      "X-Filename": audioFile.name,
    },
    body: audioFile,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Audio upload failed");
  }
  return res.json();
}
