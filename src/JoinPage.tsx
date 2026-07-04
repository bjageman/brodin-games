import { useState } from 'react';
import PageLayout from './components/shared/PageLayout';
import GameSession from './components/game/GameSession';

export default function JoinPage() {
  const [code, setCode] = useState(() => {
    const params = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
    const urlCode = params.get('code');
    return urlCode && urlCode.length === 4 ? urlCode.toUpperCase() : '';
  });
  const [name, setName] = useState(() => localStorage.getItem('brodin-name') || '');
  const [joined, setJoined] = useState(false);
  const [playerId] = useState(() => {
    const saved = sessionStorage.getItem('brodin-player-id');
    if (saved) return saved;
    const id = 'p-' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('brodin-player-id', id);
    return id;
  });

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 4 || !name.trim()) return;
    localStorage.setItem('brodin-name', name);
    setJoined(true);
  };

  if (!joined) {
    return (
      <PageLayout title="Join Game" backHref="#/">
        <form onSubmit={handleJoin} className="w-full max-w-md mx-auto border border-brodin-primary/30 rounded-lg p-6 space-y-4 bg-brodin-panel">
          <h2 className="text-center font-display text-base font-bold uppercase tracking-wide">Enter Game Room</h2>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Room Code</label>
            <input
              type="text"
              placeholder="e.g. KVTQ"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
              className="w-full text-center text-xl font-bold rounded-lg border border-brodin-primary/40 bg-gray-900 py-2.5 tracking-widest uppercase text-white focus:outline-none focus:border-brodin-accent"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Name</label>
            <input
              type="text"
              placeholder="Enter your name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-brodin-primary/40 bg-gray-900 px-4 py-2.5 text-center font-semibold text-white focus:outline-none focus:border-brodin-accent"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-brodin-primary hover:bg-brodin-primaryDark text-white rounded-lg py-3 font-bold transition-colors"
          >
            Join Game Room
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
        isHost={false}
        onLeaveGame={() => setJoined(false)}
      />
    </PageLayout>
  );
}
