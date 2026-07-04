import PageLayout from './components/shared/PageLayout';

export default function HomePage() {
  return (
    <PageLayout title="Brodin Games">
      <div className="w-full max-w-md mx-auto space-y-3">
        <a
          href="#/join"
          className="block border border-brodin-primary/30 border-l-4 border-l-brodin-accent rounded-lg p-5 bg-brodin-panel hover:bg-brodin-panel/70 transition-colors"
        >
          <h2 className="font-display text-base font-bold tracking-wide text-brodin-accent">Join Game</h2>
          <p className="text-xs mt-0.5 text-gray-400">Enter a room with a 4-letter code from your phone.</p>
        </a>

        <a
          href="#/host"
          className="block border border-brodin-primary/30 border-l-4 border-l-brodin-primary rounded-lg p-5 bg-brodin-panel hover:bg-brodin-panel/70 transition-colors"
        >
          <h2 className="font-display text-base font-bold tracking-wide text-brodin-primary">Host Game</h2>
          <p className="text-xs mt-0.5 text-gray-400">Start a session and share the QR code with everyone.</p>
        </a>
      </div>

      <div className="w-full max-w-md mx-auto text-center mt-8">
        <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-3">Featured Game</h3>
        <div className="border border-brodin-primary/30 rounded-lg p-4 bg-brodin-panel">
          <p className="font-display font-bold text-brodin-gold">Ad-libs Race</p>
          <p className="text-xs text-gray-400 mt-1">
            Race the clock to type words, then fill in someone else's mad-libs sheet with them.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
