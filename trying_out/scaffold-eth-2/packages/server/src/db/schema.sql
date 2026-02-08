-- ──────────────────────────────────────────────
-- BeatStream Database Schema
-- Run this in Supabase SQL Editor
-- ──────────────────────────────────────────────

-- Users (both listeners and artists start here)
CREATE TABLE IF NOT EXISTS users (
  wallet_address TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'artist')),
  beats_balance BIGINT NOT NULL DEFAULT 0,
  ens_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artists (linked to users, extra artist-specific fields)
CREATE TABLE IF NOT EXISTS artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL REFERENCES users(wallet_address),
  ens_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  usdc_earned NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracks (uploaded by artists)
CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  chunks INTEGER NOT NULL,
  cover_url TEXT,
  is_private BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streaming sessions (state channels)
CREATE TABLE IF NOT EXISTS sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL REFERENCES users(wallet_address),
  artist_id UUID NOT NULL REFERENCES artists(id),
  track_id UUID NOT NULL REFERENCES tracks(id),
  start_time TIMESTAMPTZ DEFAULT NOW(),
  total_beats_paid BIGINT NOT NULL DEFAULT 0,
  last_signature TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'SETTLED', 'DISPUTED'))
);

-- ──────────────────────────────────────────────
-- RPC Functions (atomic DB operations called from server)
-- ──────────────────────────────────────────────

-- Credit beats to a user
CREATE OR REPLACE FUNCTION credit_beats(p_wallet TEXT, p_beats BIGINT)
RETURNS BIGINT AS $$
DECLARE
  new_balance BIGINT;
BEGIN
  UPDATE users
  SET beats_balance = beats_balance + p_beats
  WHERE wallet_address = LOWER(p_wallet)
  RETURNING beats_balance INTO new_balance;
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql;

-- Debit 1 beat from a user (returns new balance, -1 if insufficient)
CREATE OR REPLACE FUNCTION debit_beat(p_wallet TEXT)
RETURNS BIGINT AS $$
DECLARE
  new_balance BIGINT;
BEGIN
  UPDATE users
  SET beats_balance = beats_balance - 1
  WHERE wallet_address = LOWER(p_wallet)
    AND beats_balance > 0
  RETURNING beats_balance INTO new_balance;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql;

-- Increment session payment counter and store last signature
CREATE OR REPLACE FUNCTION increment_session_payment(p_session_id UUID, p_signature TEXT)
RETURNS BIGINT AS $$
DECLARE
  new_total BIGINT;
BEGIN
  UPDATE sessions
  SET total_beats_paid = total_beats_paid + 1,
      last_signature = p_signature
  WHERE session_id = p_session_id
    AND status = 'OPEN'
  RETURNING total_beats_paid INTO new_total;
  RETURN new_total;
END;
$$ LANGUAGE plpgsql;

-- Credit artist USDC earnings
CREATE OR REPLACE FUNCTION credit_artist_earnings(p_artist_id UUID, p_usdc NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE artists
  SET usdc_earned = usdc_earned + p_usdc
  WHERE id = p_artist_id;
END;
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────────────────
-- Seed Data (demo artists & tracks for testing)
-- ──────────────────────────────────────────────

-- Seed users (artists need user rows first)
INSERT INTO users (wallet_address, role, ens_name) VALUES
  ('0x1111111111111111111111111111111111111111', 'artist', 'synthwave.beatstream.eth'),
  ('0x2222222222222222222222222222222222222222', 'artist', 'neonbeats.beatstream.eth'),
  ('0x3333333333333333333333333333333333333333', 'artist', 'lofiking.beatstream.eth')
ON CONFLICT DO NOTHING;

-- Seed artists
INSERT INTO artists (id, wallet_address, ens_name, display_name) VALUES
  ('a1000000-0000-0000-0000-000000000001', '0x1111111111111111111111111111111111111111', 'synthwave.beatstream.eth', 'SynthWave'),
  ('a1000000-0000-0000-0000-000000000002', '0x2222222222222222222222222222222222222222', 'neonbeats.beatstream.eth', 'NeonBeats'),
  ('a1000000-0000-0000-0000-000000000003', '0x3333333333333333333333333333333333333333', 'lofiking.beatstream.eth', 'LoFi King')
ON CONFLICT DO NOTHING;

-- Seed tracks
INSERT INTO tracks (id, artist_id, title, duration_seconds, chunks, is_private) VALUES
  ('t1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Midnight Drive', 180, 36, false),
  ('t1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Neon Skyline', 210, 42, true),
  ('t1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 'Electric Dreams', 195, 39, true),
  ('t1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003', 'Rainy Afternoon', 240, 48, false),
  ('t1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000003', 'Coffee Shop Vibes', 165, 33, true)
ON CONFLICT DO NOTHING;
