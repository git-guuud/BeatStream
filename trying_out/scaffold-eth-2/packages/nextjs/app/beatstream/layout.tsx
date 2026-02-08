"use client";

import { BeatsProvider } from "./_components/BeatsContext";

export default function BeatStreamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BeatsProvider>{children}</BeatsProvider>;
}
