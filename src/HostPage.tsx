import { useState } from 'react';
import { generateGameCode } from './utils/gameCode';
import PageLayout from './components/shared/PageLayout';
import GameSession from './components/game/GameSession';

export default function HostPage() {
  const [name, setName] = useState(() => localStorage.getItem('brodin-name') || '');
  const [started, setStarted] = useState(false);
  const [code] = useState(() => generateGameCode());
  const [playerId] = useState(() => {
    const saved = sessionStorage.getItem('brodin-player-id');
    if (saved) return saved;
    const id = 'p-' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('brodin-player-id', id);
    return id;
  });

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    localStorage.setItem('brodin-name', name);
    setStarted(true);
  };

  if (!started) {
    return (
      <PageLayout title="Host a Game" backHref="#/">
        <form onSubmit={handleStart} className="w-full max-w-md mx-auto border border-brodin-primary/30 rounded-lg p-6 space-y-4 bg-brodin-panel">
          <h2 className="text-center font-display text-base font-bold uppercase tracking-wide">Enter Your Name</h2>
          <input
            type="text"
            autoFocus
            placeholder="Your name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-brodin-primary/40 bg-gray-900 px-4 py-2.5 text-center font-semibold text-white focus:outline-none focus:border-brodin-accent"
            required
          />
          <button
            type="submit"
            className="w-full bg-brodin-primary hover:bg-brodin-primaryDark text-white rounded-lg py-3 font-bold transition-colors"
          >
            Create Room
          </button>
        </form>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Ad-libs Race">
      <GameSession
        code={code}
        playerId={playerId}
        name={name}
        isHost={true}
        onLeaveGame={() => setStarted(false)}
      />
    </PageLayout>
  );
}
