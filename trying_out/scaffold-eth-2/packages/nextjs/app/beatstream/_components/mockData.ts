// Mock data for demo purposes
export interface Artist {
  id: string;
  name: string;
  avatar: string;
  genre: string;
}

export interface Track {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  duration: number; // in seconds
  coverUrl: string;
  audioUrl?: string; // URL to audio file
}

// Free sample audio URLs for demo (royalty-free samples)
const SAMPLE_AUDIO = [
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
];

export const mockArtists: Artist[] = [
  { id: "1", name: "Luna Wave", avatar: "🌙", genre: "Electronic" },
  { id: "2", name: "The Midnight", avatar: "🌃", genre: "Synthwave" },
  { id: "3", name: "Crystal Echoes", avatar: "💎", genre: "Ambient" },
  { id: "4", name: "Neon Dreams", avatar: "🌈", genre: "Pop" },
  { id: "5", name: "Cyber Pulse", avatar: "⚡", genre: "Techno" },
];

export const mockTracks: Track[] = [
  // Luna Wave tracks
  { id: "t1", title: "Moonlight Sonata Remix", artistId: "1", artistName: "Luna Wave", duration: 245, coverUrl: "🎵", audioUrl: SAMPLE_AUDIO[0] },
  { id: "t2", title: "Ocean Waves", artistId: "1", artistName: "Luna Wave", duration: 312, coverUrl: "🎵", audioUrl: SAMPLE_AUDIO[1] },
  { id: "t3", title: "Starry Night", artistId: "1", artistName: "Luna Wave", duration: 198, coverUrl: "🎵", audioUrl: SAMPLE_AUDIO[2] },
  
  // The Midnight tracks
  { id: "t4", title: "Neon City", artistId: "2", artistName: "The Midnight", duration: 267, coverUrl: "🎶", audioUrl: SAMPLE_AUDIO[3] },
  { id: "t5", title: "Retrograde", artistId: "2", artistName: "The Midnight", duration: 289, coverUrl: "🎶", audioUrl: SAMPLE_AUDIO[4] },
  { id: "t6", title: "Sunset Dreams", artistId: "2", artistName: "The Midnight", duration: 234, coverUrl: "🎶", audioUrl: SAMPLE_AUDIO[5] },
  
  // Crystal Echoes tracks
  { id: "t7", title: "Floating", artistId: "3", artistName: "Crystal Echoes", duration: 456, coverUrl: "🎹", audioUrl: SAMPLE_AUDIO[6] },
  { id: "t8", title: "Deep Waters", artistId: "3", artistName: "Crystal Echoes", duration: 387, coverUrl: "🎹", audioUrl: SAMPLE_AUDIO[7] },
  
  // Neon Dreams tracks
  { id: "t9", title: "Dance All Night", artistId: "4", artistName: "Neon Dreams", duration: 213, coverUrl: "🎤", audioUrl: SAMPLE_AUDIO[0] },
  { id: "t10", title: "Summer Vibes", artistId: "4", artistName: "Neon Dreams", duration: 198, coverUrl: "🎤", audioUrl: SAMPLE_AUDIO[1] },
  { id: "t11", title: "Feel Good", artistId: "4", artistName: "Neon Dreams", duration: 245, coverUrl: "🎤", audioUrl: SAMPLE_AUDIO[2] },
  
  // Cyber Pulse tracks
  { id: "t12", title: "Digital Storm", artistId: "5", artistName: "Cyber Pulse", duration: 334, coverUrl: "🔊", audioUrl: SAMPLE_AUDIO[3] },
  { id: "t13", title: "Binary Code", artistId: "5", artistName: "Cyber Pulse", duration: 298, coverUrl: "🔊", audioUrl: SAMPLE_AUDIO[4] },
  { id: "t14", title: "System Override", artistId: "5", artistName: "Cyber Pulse", duration: 312, coverUrl: "🔊", audioUrl: SAMPLE_AUDIO[5] },
];

export function getTracksByArtist(artistId: string): Track[] {
  return mockTracks.filter(track => track.artistId === artistId);
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
