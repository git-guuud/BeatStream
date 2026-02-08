-- ──────────────────────────────────────────────
-- BeatStream Database Migration v2
-- Adds: audio storage, genre, play counts, ENS tracking, fan subdomains
-- Run this in Supabase SQL Editor AFTER schema.sql
-- ──────────────────────────────────────────────

-- ═══════════════════════════════════════════════
-- 1. TRACKS — add audio_url, genre, play_count
-- ═══════════════════════════════════════════════

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS genre TEXT DEFAULT 'other';
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS play_count BIGINT NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════
-- 2. ARTISTS — add bio, genre, total_streams
-- ═══════════════════════════════════════════════

ALTER TABLE artists ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS genre TEXT DEFAULT 'other';
ALTER TABLE artists ADD COLUMN IF NOT EXISTS total_streams BIGINT NOT NULL DEFAULT 0;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS ens_registered BOOLEAN NOT NULL DEFAULT false;

-- ═══════════════════════════════════════════════
-- 3. FAN SUBDOMAINS — track minted fan subdomains
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fan_subdomains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_wallet TEXT NOT NULL REFERENCES users(wallet_address),
  artist_id UUID NOT NULL REFERENCES artists(id),
  subdomain TEXT NOT NULL,                -- e.g. "fan-abc123.synthwave.beatstream.eth"
  total_beats_streamed BIGINT NOT NULL,   -- beats at time of minting
  tx_hash TEXT,                            -- on-chain minting tx (null if pending)
  minted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fan_wallet, artist_id)           -- one subdomain per fan-artist pair
);

-- ═══════════════════════════════════════════════
-- 4. STREAMING HISTORY — lightweight per-session log
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stream_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL REFERENCES users(wallet_address),
  artist_id UUID NOT NULL REFERENCES artists(id),
  track_id UUID NOT NULL REFERENCES tracks(id),
  session_id UUID REFERENCES sessions(session_id),
  beats_paid BIGINT NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  settled_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast fan-eligibility queries
CREATE INDEX IF NOT EXISTS idx_stream_history_fan
  ON stream_history(user_wallet, artist_id);

-- ═══════════════════════════════════════════════
-- 5. NEW RPC FUNCTIONS
-- ═══════════════════════════════════════════════

-- Increment track play count
CREATE OR REPLACE FUNCTION increment_play_count(p_track_id UUID)
RETURNS BIGINT AS $$
DECLARE
  new_count BIGINT;
BEGIN
  UPDATE tracks
  SET play_count = play_count + 1
  WHERE id = p_track_id
  RETURNING play_count INTO new_count;
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Increment artist total streams
CREATE OR REPLACE FUNCTION increment_artist_streams(p_artist_id UUID)
RETURNS BIGINT AS $$
DECLARE
  new_count BIGINT;
BEGIN
  UPDATE artists
  SET total_streams = total_streams + 1
  WHERE id = p_artist_id
  RETURNING total_streams INTO new_count;
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Get total beats a fan has streamed from a specific artist
CREATE OR REPLACE FUNCTION get_fan_artist_beats(p_wallet TEXT, p_artist_id UUID)
RETURNS BIGINT AS $$
DECLARE
  total BIGINT;
BEGIN
  SELECT COALESCE(SUM(beats_paid), 0) INTO total
  FROM stream_history
  WHERE user_wallet = LOWER(p_wallet)
    AND artist_id = p_artist_id;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Record stream in history (called during session settlement)
CREATE OR REPLACE FUNCTION record_stream(
  p_wallet TEXT,
  p_artist_id UUID,
  p_track_id UUID,
  p_session_id UUID,
  p_beats BIGINT,
  p_duration INTEGER
) RETURNS void AS $$
BEGIN
  INSERT INTO stream_history (user_wallet, artist_id, track_id, session_id, beats_paid, duration_seconds)
  VALUES (LOWER(p_wallet), p_artist_id, p_track_id, p_session_id, p_beats, p_duration);
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════
-- 6. SUPABASE STORAGE BUCKET — for audio files
-- ═══════════════════════════════════════════════

-- Create audio bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true)
ON CONFLICT DO NOTHING;

-- Allow public read access to audio files
DROP POLICY IF EXISTS "Public audio read" ON storage.objects;
CREATE POLICY "Public audio read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio');

-- Allow authenticated uploads (server uses service role key, bypasses RLS)
-- The server handles auth; Supabase just stores the file.

-- ═══════════════════════════════════════════════
-- 7. UPDATE SEED DATA with genres and audio
-- ═══════════════════════════════════════════════

UPDATE artists SET genre = 'synthwave', bio = 'Retro-futuristic soundscapes' WHERE ens_name = 'synthwave.beatstream.eth';
UPDATE artists SET genre = 'electronic', bio = 'Neon-lit electronic beats' WHERE ens_name = 'neonbeats.beatstream.eth';
UPDATE artists SET genre = 'lofi', bio = 'Chill beats to study to' WHERE ens_name = 'lofiking.beatstream.eth';

UPDATE tracks SET genre = 'synthwave' WHERE artist_id = 'a1000000-0000-0000-0000-000000000001'::uuid;
UPDATE tracks SET genre = 'electronic' WHERE artist_id = 'a1000000-0000-0000-0000-000000000002'::uuid;
UPDATE tracks SET genre = 'lofi' WHERE artist_id = 'a1000000-0000-0000-0000-000000000003'::uuid;
