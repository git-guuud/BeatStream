"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PlayerBar } from "./_components/PlayerBar";
import { 
  fetchArtists, 
  fetchTracks, 
  formatDuration, 
  getAvatarEmoji,
  type Artist, 
  type Track 
} from "./_components/api";
import { mockArtists, mockTracks } from "./_components/mockData";

// Adapter to convert API Artist to display format
interface DisplayArtist {
  id: string;
  name: string;
  avatar: string;
  genre: string;
}

// Adapter to convert API Track to display format
interface DisplayTrack {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  duration: number;
  coverUrl: string;
}

function toDisplayArtist(artist: Artist): DisplayArtist {
  return {
    id: artist.id,
    name: artist.display_name,
    avatar: artist.avatar_url || getAvatarEmoji(artist.display_name),
    genre: artist.ens_name.replace(".beatstream.eth", ""),
  };
}

function toDisplayTrack(track: Track, artists: Artist[]): DisplayTrack {
  const artist = artists.find(a => a.id === track.artist_id);
  return {
    id: track.id,
    title: track.title,
    artistId: track.artist_id,
    artistName: artist?.display_name || "Unknown Artist",
    duration: track.duration_seconds,
    coverUrl: track.cover_url || "🎵",
  };
}

const INITIAL_BEATS = 5000;
const LOW_BEATS_WARNING = 1000;

export default function BeatStreamPage() {
  const [artists, setArtists] = useState<DisplayArtist[]>(mockArtists);
  const [allTracks, setAllTracks] = useState<DisplayTrack[]>(mockTracks);
  const [selectedArtist, setSelectedArtist] = useState<DisplayArtist | null>(null);
  const [currentTrack, setCurrentTrack] = useState<DisplayTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [beatsBalance, setBeatsBalance] = useState(INITIAL_BEATS);
  const [isLoading, setIsLoading] = useState(true);
  const [useApi, setUseApi] = useState(false);
  const shouldAutoAdvance = useRef(false);

  const isLowOnBeats = beatsBalance < LOW_BEATS_WARNING && beatsBalance > 0;
  const isOutOfBeats = beatsBalance <= 0;

  // Fetch data from API on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [apiArtists, apiTracks] = await Promise.all([
          fetchArtists(),
          fetchTracks(),
        ]);
        
        if (apiArtists.length > 0) {
          const displayArtists = apiArtists.map(toDisplayArtist);
          const displayTracks = apiTracks.map(t => toDisplayTrack(t, apiArtists));
          setArtists(displayArtists);
          setAllTracks(displayTracks);
          setSelectedArtist(displayArtists[0]);
          setUseApi(true);
          console.log("✅ Connected to BeatStream API");
        } else {
          // Use mock data if no artists in DB
          setSelectedArtist(mockArtists[0]);
          console.log("ℹ️ Using mock data (no artists in DB)");
        }
      } catch (err) {
        // Fallback to mock data if API fails
        console.log("ℹ️ Using mock data (API unavailable)");
        setSelectedArtist(mockArtists[0]);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const artistTracks = selectedArtist 
    ? allTracks.filter(t => t.artistId === selectedArtist.id) 
    : [];

  // Auto-advance to next track when needed
  useEffect(() => {
    if (shouldAutoAdvance.current && currentTrack) {
      shouldAutoAdvance.current = false;
      const currentIndex = allTracks.findIndex(t => t.id === currentTrack.id);
      const nextTrack = allTracks[(currentIndex + 1) % allTracks.length];
      if (nextTrack) {
        setCurrentTrack(nextTrack);
        setCurrentTime(0);
        const nextArtist = artists.find(a => a.id === nextTrack.artistId);
        if (nextArtist) setSelectedArtist(nextArtist);
      }
    }
  }, [currentTime, currentTrack, allTracks, artists]);

  // Simulate playback timer - deducts 1 beat per second
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (isPlaying && currentTrack && beatsBalance > 0) {
      interval = setInterval(() => {
        setBeatsBalance(prev => {
          if (prev <= 1) {
            // Out of beats - stop playback
            setIsPlaying(false);
            return 0;
          }
          return prev - 1;
        });
        setCurrentTime(prev => {
          if (prev >= currentTrack.duration) {
            shouldAutoAdvance.current = true;
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentTrack, beatsBalance]);

  const handlePlayPause = useCallback(() => {
    // Don't allow playing if out of beats
    if (beatsBalance <= 0) return;
    
    if (!currentTrack && artistTracks.length > 0) {
      setCurrentTrack(artistTracks[0]);
      setIsPlaying(true);
    } else {
      setIsPlaying(prev => !prev);
    }
  }, [currentTrack, artistTracks, beatsBalance]);

  const handleNext = useCallback(() => {
    if (!currentTrack || allTracks.length === 0) return;
    
    const currentIndex = allTracks.findIndex(t => t.id === currentTrack.id);
    const nextTrack = allTracks[(currentIndex + 1) % allTracks.length];
    setCurrentTrack(nextTrack);
    setCurrentTime(0);
    
    // Also select the artist of the next track
    const nextArtist = artists.find(a => a.id === nextTrack.artistId);
    if (nextArtist) setSelectedArtist(nextArtist);
  }, [currentTrack, allTracks, artists]);

  const handlePrevious = useCallback(() => {
    if (!currentTrack || allTracks.length === 0) return;
    
    const currentIndex = allTracks.findIndex(t => t.id === currentTrack.id);
    const prevTrack = allTracks[(currentIndex - 1 + allTracks.length) % allTracks.length];
    setCurrentTrack(prevTrack);
    setCurrentTime(0);
    
    // Also select the artist of the previous track
    const prevArtist = artists.find(a => a.id === prevTrack.artistId);
    if (prevArtist) setSelectedArtist(prevArtist);
  }, [currentTrack, allTracks, artists]);

  const handleTrackSelect = (track: DisplayTrack) => {
    if (beatsBalance <= 0) return; // Don't play if out of beats
    setCurrentTrack(track);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const handleArtistSelect = (artist: DisplayArtist) => {
    setSelectedArtist(artist);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl">Loading BeatStream...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen pb-24">
      {/* Low Beats Warning Banner */}
      {isLowOnBeats && (
        <div className="bg-warning text-warning-content px-4 py-2 text-center text-sm font-medium">
          ⚠️ Low on Beats! Only {beatsBalance} beats remaining. <a href="/beatstream/deposit" className="underline font-bold">Top up now</a> to continue streaming.
        </div>
      )}
      
      {/* Out of Beats Banner */}
      {isOutOfBeats && (
        <div className="bg-error text-error-content px-4 py-2 text-center text-sm font-medium">
          🚫 You're out of Beats! <a href="/beatstream/deposit" className="underline font-bold">Deposit USDC</a> to continue streaming.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
      {/* Left Sidebar - Artists */}
      <aside className="w-64 bg-base-200 border-r border-base-content/10 overflow-y-auto">
        <div className="p-4">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            🎵 BeatStream
          </h2>
          <h3 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">
            Artists {useApi && <span className="text-xs text-success">(Live)</span>}
          </h3>
          <ul className="space-y-1">
            {artists.map(artist => (
              <li key={artist.id}>
                <button
                  onClick={() => handleArtistSelect(artist)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    selectedArtist?.id === artist.id
                      ? "bg-primary text-primary-content"
                      : "hover:bg-base-300"
                  }`}
                >
                  <span className="text-2xl">{artist.avatar}</span>
                  <div className="text-left min-w-0">
                    <div className="font-medium truncate">{artist.name}</div>
                    <div className={`text-xs truncate ${
                      selectedArtist?.id === artist.id
                        ? "text-primary-content/70"
                        : "text-base-content/60"
                    }`}>
                      {artist.genre}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main Content - Track List */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {selectedArtist ? (
            <>
              {/* Artist Header */}
              <div className="flex items-center gap-4 mb-6">
                <span className="text-6xl">{selectedArtist.avatar}</span>
                <div>
                  <h1 className="text-3xl font-bold">{selectedArtist.name}</h1>
                  <p className="text-base-content/60">{selectedArtist.genre} • {artistTracks.length} tracks</p>
                </div>
              </div>

              {/* Track List */}
              <div className="bg-base-200 rounded-lg overflow-hidden">
                <table className="table w-full">
                  <thead>
                    <tr className="text-base-content/60">
                      <th className="w-12">#</th>
                      <th>Title</th>
                      <th className="w-24 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {artistTracks.map((track, index) => (
                      <tr
                        key={track.id}
                        onClick={() => handleTrackSelect(track)}
                        className={`cursor-pointer hover:bg-base-300 transition-colors ${
                          currentTrack?.id === track.id ? "bg-primary/20" : ""
                        }`}
                      >
                        <td className="font-mono text-base-content/60">
                          {currentTrack?.id === track.id && isPlaying ? (
                            <span className="text-primary">▶</span>
                          ) : (
                            index + 1
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{track.coverUrl}</span>
                            <span className={currentTrack?.id === track.id ? "text-primary font-medium" : ""}>
                              {track.title}
                            </span>
                          </div>
                        </td>
                        <td className="text-right text-base-content/60">
                          {formatDuration(track.duration)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Info Box */}
              <div className="mt-6 p-4 bg-base-200 rounded-lg border border-primary/20">
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <span>💡</span> How BeatStream Works
                </h3>
                <p className="text-sm text-base-content/70">
                  Each second of streaming costs 1 Beat. Beats are purchased with USDC and 
                  streamed to artists in real-time using Yellow Network state channels.
                  Connect your wallet to start streaming!
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-base-content/40">
              Select an artist to view their tracks
            </div>
          )}
        </div>
      </main>
      </div>

      {/* Player Bar */}
      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        beatsBalance={beatsBalance}
        isLowOnBeats={isLowOnBeats}
        isOutOfBeats={isOutOfBeats}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrevious={handlePrevious}
      />
    </div>
  );
}
