import { cn } from '../../../shared/utils/cn';
import type { PlayerInfo } from '../../../shared/types';
import type { PlayerCombat } from '../types';

export default function GameOverView({
  players, roster, winnerIds, isHost, onQuit,
}: {
  players: Record<string, PlayerCombat>;
  roster: PlayerInfo[];
  winnerIds: string[];
  isHost: boolean;
  onQuit: () => void;
}) {
  const ranked = [...roster].sort((a, b) => (players[b.id]?.score ?? 0) - (players[a.id]?.score ?? 0));
  const winnerNames = roster.filter((p) => winnerIds.includes(p.id)).map((p) => p.name);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 px-4 py-10 text-center">
      <span className="text-5xl">🏆</span>
      <div>
        <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-quiz-gold">
          The Boss Falls!
        </h2>
        <p className="mt-1 text-sm text-quiz-ink/70">
          {winnerNames.length > 1 ? `${winnerNames.join(' & ')} tie for the win` : `${winnerNames[0]} wins the run`}
        </p>
      </div>

      <div className="w-full space-y-1.5">
        {ranked.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              'flex items-center justify-between rounded-lg border-2 px-4 py-2 text-sm font-bold',
              winnerIds.includes(p.id) ? 'border-quiz-gold bg-quiz-gold/15 text-quiz-gold' : 'border-quiz-gold/30 text-quiz-ink'
            )}
          >
            <span className="truncate">{i + 1}. {p.name}</span>
            <span>{players[p.id]?.score ?? 0} pts</span>
          </div>
        ))}
      </div>

      {isHost ? (
        <button
          onClick={onQuit}
          className="w-full rounded-full bg-quiz-gold py-3 font-display text-sm font-black uppercase tracking-wider text-quiz-bg transition-transform hover:scale-[1.02]"
        >
          Back to Lobby
        </button>
      ) : (
        <p className="text-sm text-quiz-ink/70">Waiting for the host…</p>
      )}
    </div>
  );
}
