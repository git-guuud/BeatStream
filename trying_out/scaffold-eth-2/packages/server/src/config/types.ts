// ──────────────────────────────────────────────
// BeatStream Types
// ──────────────────────────────────────────────

export type UserRole = "user" | "artist";
export type SessionStatus = "OPEN" | "SETTLED" | "DISPUTED";

export interface User {
  wallet_address: string;
  role: UserRole;
  beats_balance: number;
  ens_name: string | null;
  created_at: string;
}

export interface Artist {
  id: string;
  wallet_address: string;
  ens_name: string;          // e.g. "synthwave.beatstream.eth"
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  genre: string | null;
  usdc_earned: number;
  total_streams: number;
  ens_registered: boolean;
  created_at: string;
}

export interface Track {
  id: string;
  artist_id: string;
  title: string;
  duration_seconds: number;
  chunks: number;
  cover_url: string | null;
  audio_url: string | null;
  genre: string | null;
  play_count: number;
  is_private: boolean;
  created_at: string;
}

export interface Session {
  session_id: string;
  user_wallet: string;
  artist_id: string;
  track_id: string;
  start_time: string;
  total_beats_paid: number;
  last_signature: string | null;
  status: SessionStatus;
}

export interface FanSubdomain {
  id: string;
  fan_wallet: string;
  artist_id: string;
  subdomain: string;
  total_beats_streamed: number;
  tx_hash: string | null;
  minted_at: string;
}

export interface StreamHistory {
  id: string;
  user_wallet: string;
  artist_id: string;
  track_id: string;
  session_id: string | null;
  beats_paid: number;
  duration_seconds: number;
  settled_at: string;
}

// ─── API Request / Response ───

export interface RegisterArtistRequest {
  wallet_address: string;
  display_name: string;
}

export interface RegisterArtistResponse {
  artist: Artist;
  ens_name: string;
}

export interface RegisterUserRequest {
  wallet_address: string;
  ens_name?: string;
}

export interface DepositRequest {
  user_wallet: string;
  usdc_amount: number;
}

export interface DepositResponse {
  beats_credited: number;
  new_balance: number;
  tx_hash: string;
}

export interface UploadTrackRequest {
  artist_wallet: string;
  title: string;
  duration_seconds: number;
  is_private: boolean;
}

export interface InitSessionRequest {
  artist_id: string;
  track_id: string;
  user_wallet: string;
}

export interface InitSessionResponse {
  session_id: string;
  status: SessionStatus;
  track: Track;
}

export interface StreamVerifyRequest {
  session_id: string;
  signature: string;
  timestamp: number;
}

export interface StreamVerifyResponse {
  ok: boolean;
  chunk_index: number;
  chunk_url: string;
  beats_remaining: number;
  total_paid: number;
}

export interface SettleSessionRequest {
  session_id: string;
}

export interface SettleSessionResponse {
  status: "SETTLED";
  total_beats_paid: number;
  usdc_settled: number;
  fan_subdomain?: string;
}

export interface StreamVoucher {
  session_id: string;
  timestamp: number;
  amount: number;
}
