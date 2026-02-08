// ──────────────────────────────────────────────
// BeatStream — Landing Page (placeholder)
// TODO: Implement hero, artist showcase, connect wallet
// ──────────────────────────────────────────────
export default function BeatStreamPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">🎵 BeatStream</h1>
      <p className="text-xl text-gray-500 mb-8">Pay-per-second music streaming on Web3</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
        <div className="p-6 border rounded-lg">
          <h3 className="font-bold mb-2">🟡 Yellow Network</h3>
          <p className="text-sm text-gray-500">State channels for real-time micro-payments</p>
        </div>
        <div className="p-6 border rounded-lg">
          <h3 className="font-bold mb-2">💰 Circle Arc</h3>
          <p className="text-sm text-gray-500">USDC deposits and artist settlements</p>
        </div>
        <div className="p-6 border rounded-lg">
          <h3 className="font-bold mb-2">🆔 ENS</h3>
          <p className="text-sm text-gray-500">Artist identities &amp; fan subdomains</p>
        </div>
      </div>
    </div>
  );
}
