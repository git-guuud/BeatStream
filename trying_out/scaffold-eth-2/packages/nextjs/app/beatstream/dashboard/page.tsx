"use client";

import { BeatStreamNav } from "../_components/BeatStreamNav";

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <BeatStreamNav />
      <div className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-4">📊 Artist Dashboard</h1>
        <p className="text-base-content/60 mb-8">
          Upload tracks and view your earnings
        </p>
        
        <div className="bg-base-200 rounded-lg p-6">
          <p className="text-center text-base-content/60">
            Dashboard features coming soon...
          </p>
          <ul className="mt-4 space-y-2 text-sm text-base-content/60">
            <li>• Upload and manage your tracks</li>
            <li>• View streaming earnings</li>
            <li>• See fan engagement statistics</li>
            <li>• Manage your artist profile</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
