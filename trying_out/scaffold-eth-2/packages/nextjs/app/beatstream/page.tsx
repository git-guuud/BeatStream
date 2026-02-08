"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PlayerBar } from "./_components/PlayerBar";
import { mockArtists, mockTracks, getTracksByArtist, formatDuration, Track, Artist } from "./_components/mockData";

export default function BeatStreamPage() {
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(mockArtists[0]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const shouldAutoAdvance = useRef(false);

  const artistTracks = selectedArtist ? getTracksByArtist(selectedArtist.id) : [];

  // Auto-advance to next track when needed
  useEffect(() => {
    if (shouldAutoAdvance.current && currentTrack) {
      shouldAutoAdvance.current = false;
      const currentIndex = mockTracks.findIndex(t => t.id === currentTrack.id);
      const nextTrack = mockTracks[(currentIndex + 1) % mockTracks.length];
      setCurrentTrack(nextTrack);
      setCurrentTime(0);
      const nextArtist = mockArtists.find(a => a.id === nextTrack.artistId);
      if (nextArtist) setSelectedArtist(nextArtist);
    }
  }, [currentTime, currentTrack]);

  // Simulate playback timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (isPlaying && currentTrack) {
      interval = setInterval(() => {
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
  }, [isPlaying, currentTrack]);

  const handlePlayPause = useCallback(() => {
    if (!currentTrack && artistTracks.length > 0) {
      setCurrentTrack(artistTracks[0]);
      setIsPlaying(true);
    } else {
      setIsPlaying(prev => !prev);
    }
  }, [currentTrack, artistTracks]);

  const handleNext = useCallback(() => {
    if (!currentTrack) return;
    
    const allTracks = mockTracks;
    const currentIndex = allTracks.findIndex(t => t.id === currentTrack.id);
    const nextTrack = allTracks[(currentIndex + 1) % allTracks.length];
    setCurrentTrack(nextTrack);
    setCurrentTime(0);
    
    // Also select the artist of the next track
    const nextArtist = mockArtists.find(a => a.id === nextTrack.artistId);
    if (nextArtist) setSelectedArtist(nextArtist);
  }, [currentTrack]);

  const handlePrevious = useCallback(() => {
    if (!currentTrack) return;
    
    const allTracks = mockTracks;
    const currentIndex = allTracks.findIndex(t => t.id === currentTrack.id);
    const prevTrack = allTracks[(currentIndex - 1 + allTracks.length) % allTracks.length];
    setCurrentTrack(prevTrack);
    setCurrentTime(0);
    
    // Also select the artist of the previous track
    const prevArtist = mockArtists.find(a => a.id === prevTrack.artistId);
    if (prevArtist) setSelectedArtist(prevArtist);
  }, [currentTrack]);

  const handleTrackSelect = (track: Track) => {
    setCurrentTrack(track);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const handleArtistSelect = (artist: Artist) => {
    setSelectedArtist(artist);
  };

  return (
    <div className="flex h-screen pb-24">
      {/* Left Sidebar - Artists */}
      <aside className="w-64 bg-base-200 border-r border-base-content/10 overflow-y-auto">
        <div className="p-4">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            🎵 BeatStream
          </h2>
          <h3 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">
            Artists
          </h3>
          <ul className="space-y-1">
            {mockArtists.map(artist => (
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

      {/* Player Bar */}
      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrevious={handlePrevious}
      />
    </div>
  );
}
