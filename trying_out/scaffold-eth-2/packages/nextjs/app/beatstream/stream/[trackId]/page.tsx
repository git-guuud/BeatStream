// Placeholder — Streaming player page
// Route: /beatstream/stream/[trackId]
export default function StreamPage({ params }: { params: { trackId: string } }) {
  return <div>Now streaming: {params.trackId} (TODO)</div>;
}
