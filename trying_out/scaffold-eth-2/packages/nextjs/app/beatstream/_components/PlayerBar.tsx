"use client";

import React from "react";
import { Track, formatDuration } from "./mockData";

interface PlayerBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function PlayerBar({
  currentTrack,
  isPlaying,
  currentTime,
  onPlayPause,
  onNext,
  onPrevious,
}: PlayerBarProps) {
  const progress = currentTrack ? (currentTime / currentTrack.duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-base-300 border-t border-base-content/10 p-4 z-50">
      <div className="max-w-6xl mx-auto flex items-center gap-4">
        {/* Track Info */}
        <div className="flex items-center gap-3 w-64 min-w-0">
          {currentTrack ? (
            <>
              <div className="text-3xl">{currentTrack.coverUrl}</div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{currentTrack.title}</div>
                <div className="text-sm text-base-content/60 truncate">
                  {currentTrack.artistName}
                </div>
              </div>
            </>
          ) : (
            <div className="text-base-content/40">No track selected</div>
          )}
        </div>

        {/* Player Controls */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            {/* Previous Button */}
            <button
              onClick={onPrevious}
              className="btn btn-circle btn-sm btn-ghost"
              disabled={!currentTrack}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M9.195 18.44c1.25.713 2.805-.19 2.805-1.629v-2.34l6.945 3.968c1.25.714 2.805-.188 2.805-1.628V8.188c0-1.44-1.555-2.342-2.805-1.628L12 10.528V8.19c0-1.44-1.555-2.343-2.805-1.629l-7.108 4.062c-1.26.72-1.26 2.536 0 3.256l7.108 4.061z" />
              </svg>
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={onPlayPause}
              className="btn btn-circle btn-primary"
              disabled={!currentTrack}
            >
              {isPlaying ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    fillRule="evenodd"
                    d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            {/* Next Button */}
            <button
              onClick={onNext}
              className="btn btn-circle btn-sm btn-ghost"
              disabled={!currentTrack}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M5.055 7.06c-1.25-.714-2.805.189-2.805 1.628v8.123c0 1.44 1.555 2.342 2.805 1.628L12 14.471v2.34c0 1.44 1.555 2.343 2.805 1.63l7.108-4.062c1.26-.72 1.26-2.536 0-3.256L14.805 7.06C13.555 6.346 12 7.25 12 8.69v2.34L5.055 7.06z" />
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-md flex items-center gap-2 text-sm">
            <span className="text-base-content/60 w-10 text-right">
              {formatDuration(currentTime)}
            </span>
            <div className="flex-1 h-1 bg-base-content/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-base-content/60 w-10">
              {currentTrack ? formatDuration(currentTrack.duration) : "0:00"}
            </span>
          </div>
        </div>

        {/* Beats Counter (Demo) */}
        <div className="w-48 text-right">
          <div className="text-sm text-base-content/60">Beats Used</div>
          <div className="font-bold text-primary">{currentTime} 🎵</div>
        </div>
      </div>
    </div>
  );
}
