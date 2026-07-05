import { useEffect, useState } from 'react';
import { generateGameCode } from './shared/utils/gameCode';
import PageLayout from './shared/components/PageLayout';
import GameShell from './shared/GameShell';
import { saveSnapshot, loadSnapshot, HOST_ROUTE_KEY } from './shared/utils/sessionSnapshot';
import MemoRandomGame from './apps/memo-random/MemoRandomGame';
import { loadDictionary } from './apps/memo-random/utils/dictionary';
import { MIN_PLAYERS, MAX_PLAYERS } from './apps/memo-random/constants';

interface HostRouteSnapshot {
  code: string;
  started: boolean;
}

export default function HostPage() {
  const restored = loadSnapshot<HostRouteSnapshot>(HOST_ROUTE_KEY);
  const [name, setName] = useState(() => localStorage.getItem('brodin-name') || '');
  const [started, setStarted] = useState(() => restored?.started ?? false);
  const [code] = useState(() => restored?.code ?? generateGameCode());
  const [playerId] = useState(() => {
    const saved = sessionStorage.getItem('brodin-player-id');
    if (saved) return saved;
    const id = 'p-' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('brodin-player-id', id);
    return id;
  });

  // Lets a refresh resume directly into the game (same room code) instead
  // of dropping back to the name-entry form.
  useEffect(() => {
    saveSnapshot(HOST_ROUTE_KEY, { code, started });
  }, [code, started]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    localStorage.setItem('brodin-name', name);
    setStarted(true);
  };

  if (!started) {
    return (
      <PageLayout title="Host a Game" backHref="#/">
        <form onSubmit={handleStart} className="w-full max-w-md sm:max-w-lg mx-auto border border-brodin-primary/30 rounded-lg p-6 space-y-4 bg-brodin-panel">
          <h2 className="text-center font-display text-base font-bold uppercase tracking-wide">Enter Your Name</h2>
          <input
            type="text"
            autoFocus
            placeholder="Your name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-brodin-primary/40 bg-brodin-field px-4 py-2.5 text-center font-semibold text-white focus:outline-none focus:border-brodin-accent"
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
    <PageLayout title="Memo-Random">
      <GameShell
        code={code}
        playerId={playerId}
        name={name}
        isHost={true}
        title="Memo-Random"
        minPlayers={MIN_PLAYERS}
        maxPlayers={MAX_PLAYERS}
        onLeaveGame={() => setStarted(false)}
        gamePlay={MemoRandomGame}
        onIdlePrefetch={loadDictionary}
      />
    </PageLayout>
  );
}
