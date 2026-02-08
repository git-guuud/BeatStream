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
}

export const mockArtists: Artist[] = [
  { id: "1", name: "Luna Wave", avatar: "🌙", genre: "Electronic" },
  { id: "2", name: "The Midnight", avatar: "🌃", genre: "Synthwave" },
  { id: "3", name: "Crystal Echoes", avatar: "💎", genre: "Ambient" },
  { id: "4", name: "Neon Dreams", avatar: "🌈", genre: "Pop" },
  { id: "5", name: "Cyber Pulse", avatar: "⚡", genre: "Techno" },
];

export const mockTracks: Track[] = [
  // Luna Wave tracks
  { id: "t1", title: "Moonlight Sonata Remix", artistId: "1", artistName: "Luna Wave", duration: 245, coverUrl: "🎵" },
  { id: "t2", title: "Ocean Waves", artistId: "1", artistName: "Luna Wave", duration: 312, coverUrl: "🎵" },
  { id: "t3", title: "Starry Night", artistId: "1", artistName: "Luna Wave", duration: 198, coverUrl: "🎵" },
  
  // The Midnight tracks
  { id: "t4", title: "Neon City", artistId: "2", artistName: "The Midnight", duration: 267, coverUrl: "🎶" },
  { id: "t5", title: "Retrograde", artistId: "2", artistName: "The Midnight", duration: 289, coverUrl: "🎶" },
  { id: "t6", title: "Sunset Dreams", artistId: "2", artistName: "The Midnight", duration: 234, coverUrl: "🎶" },
  
  // Crystal Echoes tracks
  { id: "t7", title: "Floating", artistId: "3", artistName: "Crystal Echoes", duration: 456, coverUrl: "🎹" },
  { id: "t8", title: "Deep Waters", artistId: "3", artistName: "Crystal Echoes", duration: 387, coverUrl: "🎹" },
  
  // Neon Dreams tracks
  { id: "t9", title: "Dance All Night", artistId: "4", artistName: "Neon Dreams", duration: 213, coverUrl: "🎤" },
  { id: "t10", title: "Summer Vibes", artistId: "4", artistName: "Neon Dreams", duration: 198, coverUrl: "🎤" },
  { id: "t11", title: "Feel Good", artistId: "4", artistName: "Neon Dreams", duration: 245, coverUrl: "🎤" },
  
  // Cyber Pulse tracks
  { id: "t12", title: "Digital Storm", artistId: "5", artistName: "Cyber Pulse", duration: 334, coverUrl: "🔊" },
  { id: "t13", title: "Binary Code", artistId: "5", artistName: "Cyber Pulse", duration: 298, coverUrl: "🔊" },
  { id: "t14", title: "System Override", artistId: "5", artistName: "Cyber Pulse", duration: 312, coverUrl: "🔊" },
];

export function getTracksByArtist(artistId: string): Track[] {
  return mockTracks.filter(track => track.artistId === artistId);
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
