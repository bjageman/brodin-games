import { useEffect, useState } from 'react';
import { generateGameCode } from './shared/utils/gameCode';
import PageLayout from './shared/components/PageLayout';
import GameShell from './shared/GameShell';
import { saveSnapshot, loadSnapshot, HOST_ROUTE_KEY } from './shared/utils/sessionSnapshot';
import { GAMES_REGISTRY, DEFAULT_THEME } from './shared/games';
import { cn } from './shared/utils/cn';

interface HostRouteSnapshot {
  code: string;
  started: boolean;
  isDisplay: boolean;
}

export default function HostPage() {
  const restored = loadSnapshot<HostRouteSnapshot>(HOST_ROUTE_KEY);
  const [name, setName] = useState(() => localStorage.getItem('brodin-name') || '');
  const [started, setStarted] = useState(() => restored?.started ?? false);
  const [isDisplay, setIsDisplay] = useState(() => restored?.isDisplay ?? false);
  const [code] = useState(() => restored?.code ?? generateGameCode());
  const [playerId] = useState(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem('brodin-player-id');
    } catch {}
    if (saved) return saved;
    const id = 'p-' + Math.random().toString(36).substring(2, 9);
    try {
      sessionStorage.setItem('brodin-player-id', id);
    } catch {}
    return id;
  });

  // Read game ID from the URL hash parameters (e.g. #/host?game=fake-it)
  const params = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
  const gameId = params.get('game') || 'memo-random';
  const gameConfig = GAMES_REGISTRY[gameId] || GAMES_REGISTRY['memo-random'];

  // Lets a refresh resume directly into the game (same room code) instead
  // of dropping back to the name-entry form.
  useEffect(() => {
    saveSnapshot(HOST_ROUTE_KEY, { code, started, isDisplay });
  }, [code, started, isDisplay]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    localStorage.setItem('brodin-name', name);
    setStarted(true);
  };

  if (!started) {
    // Wear the game's own colours — a Fake It room shouldn't open on dark blue.
    const theme = gameConfig.theme ?? DEFAULT_THEME;

    return (
      <PageLayout
        title={`Host ${gameConfig.title}`}
        backHref="#/"
        bgClassName={theme.pageBg}
        headerClassName={theme.heading}
        dividerClassName={theme.heading}
      >
        <form
          onSubmit={handleStart}
          className={cn('w-full max-w-md sm:max-w-lg mx-auto border rounded-lg p-6 space-y-4', theme.panel)}
        >
          <h2 className="text-center font-display text-base font-bold uppercase tracking-wide">Enter Your Name</h2>
          <input
            type="text"
            autoFocus
            placeholder="Your name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cn(
              'w-full rounded-lg border px-4 py-2.5 text-center font-semibold focus:outline-none',
              theme.field
            )}
            required
          />
          <label className={cn('flex items-center justify-center gap-2 text-sm', theme.muted)}>
            <input
              type="checkbox"
              checked={isDisplay}
              onChange={(e) => setIsDisplay(e.target.checked)}
              className={cn('h-4 w-4 rounded border', theme.field)}
            />
            I'm just displaying this on a screen (not playing)
          </label>
          <button
            type="submit"
            className={cn('w-full rounded-lg py-3 font-bold transition-colors', theme.accent)}
          >
            Create Room
          </button>
        </form>
      </PageLayout>
    );
  }

  return (
    <GameShell
      code={code}
      playerId={playerId}
      name={name}
      isHost={true}
      isDisplay={isDisplay}
      onLeaveGame={() => setStarted(false)}
      initialGameId={gameId}
    />
  );
}
