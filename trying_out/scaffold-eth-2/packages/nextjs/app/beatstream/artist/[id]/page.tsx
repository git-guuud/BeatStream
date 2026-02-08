"use client";

import { BeatStreamNav } from "../../_components/BeatStreamNav";

export default function ArtistPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex flex-col min-h-screen">
      <BeatStreamNav />
      <div className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-4">Artist Profile</h1>
        <p className="text-base-content/60">Artist ID: {params.id}</p>
        <div className="mt-4 bg-base-200 rounded-lg p-6">
          <p className="text-center text-base-content/60">Artist details coming soon...</p>
        </div>
      </div>
    </div>
  );
}
