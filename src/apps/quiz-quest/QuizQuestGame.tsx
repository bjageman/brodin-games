import { useEffect, useState, useCallback } from 'react';
import { loadSnapshot, saveSnapshot, gameSnapshotKey } from '../../shared/utils/sessionSnapshot';
import type { Envelope } from '../../shared/types';
import type { GamePlayProps } from '../../shared/GameShell';
import type { GameState } from './types';
import PartyCard from './components/PartyCard';
import MenuOverlay from './components/MenuOverlay';

interface QuizSnapshot {
  quiz: GameState;
}

const EMPTY: GameState = { phase: 'starting' };

// Scaffolding only: gets the game hostable/joinable with a working lobby and
// party roster. The room loop (question, monster, HP, scoring) is a follow-up
// once the open design questions on #76 are settled.
export default function QuizQuestGame({
  code, roster, isHost, freshStart, sendMessage, onRegisterMessageHandler, onQuit, onGameBgChange,
}: GamePlayProps) {
  const restored = freshStart ? null : loadSnapshot<QuizSnapshot>(gameSnapshotKey(code))?.quiz ?? null;
  const [state, setState] = useState<GameState>({ ...EMPTY, ...restored });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const current = loadSnapshot<Record<string, unknown>>(gameSnapshotKey(code)) ?? {};
    saveSnapshot(gameSnapshotKey(code), { ...current, quiz: state });
  }, [code, state]);

  const publish = useCallback((next: GameState) => {
    setState(next);
    sendMessage({ type: 'quiz-state-update', timestamp: Date.now(), payload: next });
  }, [sendMessage]);

  // ---- Host: once the party has joined, move past the loading spinner ----
  useEffect(() => {
    if (isHost && (state.phase === 'starting' || freshStart) && roster.length > 0) {
      const timer = setTimeout(() => {
        publish({ phase: 'party' });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isHost, freshStart, roster.length, publish, state.phase]);

  useEffect(() => {
    onRegisterMessageHandler((envelope: Envelope) => {
      if (envelope.type === 'quiz-state-update' && !isHost) {
        setState({ ...EMPTY, ...(envelope.payload as GameState) });
      } else if (envelope.type === 'quiz-request-state' && isHost) {
        if (state.phase !== 'starting') publish(state);
      }
    });
  });

  useEffect(() => {
    onGameBgChange?.('bg-quiz-bg');
    return () => onGameBgChange?.(null);
  }, [onGameBgChange]);

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 px-4 py-10 text-quiz-ink">
      {state.phase === 'starting' ? (
        <div className="w-12 h-12 border-4 border-quiz-gold border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-quiz-gold">
            The Party Assembles
          </h2>
          <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
            {roster.map((p, i) => (
              <PartyCard key={p.id} name={p.name} index={i} />
            ))}
          </div>
          <p className="max-w-md text-center text-sm text-quiz-ink/70">
            The dungeon is still being built — rooms, monsters, and trivia are coming soon.
          </p>
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-full border-2 border-quiz-gold px-6 py-2 font-display text-xs font-bold uppercase tracking-wider text-quiz-gold transition-colors hover:bg-quiz-gold hover:text-quiz-ink"
          >
            Menu
          </button>
          {menuOpen && (
            <MenuOverlay
              code={code}
              playerCount={roster.length}
              onQuit={onQuit}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
