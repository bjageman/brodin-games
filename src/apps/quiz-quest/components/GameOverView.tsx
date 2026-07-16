import { cn } from '../../../shared/utils/cn';
import { computeLeaderboard } from '../../../shared/utils/leaderboard';
import type { PlayerInfo } from '../../../shared/types';
import type { PlayerCombat } from '../types';

export default function GameOverView({
  players, roster, partyWiped, isHost, onQuit,
}: {
  players: Record<string, PlayerCombat>;
  roster: PlayerInfo[];
  winnerIds: string[];
  partyWiped: boolean;
  isHost: boolean;
  onQuit: () => void;
}) {
  const scores = Object.fromEntries(
    roster.map((p) => [p.id, players[p.id]?.score ?? 0])
  );
  const { rankedPlayers, winnerNamesFormatted, hasTies } = computeLeaderboard(roster, scores);
  const winLine = hasTies
    ? `${winnerNamesFormatted} tie on points`
    : `${winnerNamesFormatted} tops the scoreboard`;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 px-4 py-10 text-center font-pixel">
      <span className="text-5xl">{partyWiped ? '💀' : '🏆'}</span>
      <div>
        <h2
          className={cn(
            'font-pixelBlock text-2xl uppercase [text-shadow:2px_2px_0_#000]',
            partyWiped ? 'text-quiz-danger' : 'text-quiz-gold'
          )}
        >
          {partyWiped ? 'The Party Falls' : 'The Boss Falls!'}
        </h2>
        <p className="mt-2 text-sm text-quiz-ink/70">
          {partyWiped ? `Wiped out — ${winLine}` : `${winLine} — victory!`}
        </p>
      </div>

      <div className="w-full space-y-1.5">
        {rankedPlayers.map((p) => (
          <div
            key={p.id}
            className={cn(
              'flex items-center justify-between border-2 px-4 py-2 text-sm font-semibold',
              p.isWinner ? 'border-quiz-gold bg-quiz-gold/15 text-quiz-gold' : 'border-quiz-goldDark text-quiz-ink'
            )}
          >
            <span className="truncate">{p.rank}. {p.name}</span>
            <span>{p.score} pts</span>
          </div>
        ))}
      </div>

      {isHost ? (
        <button
          onClick={onQuit}
          className="w-full border-2 border-quiz-gold bg-quiz-gold py-3 font-pixelBlock text-sm uppercase text-quiz-bg transition-colors hover:bg-quiz-goldDark hover:text-quiz-ink"
        >
          Back to Lobby
        </button>
      ) : (
        <p className="text-sm text-quiz-ink/70">Waiting for the host…</p>
      )}
    </div>
  );
}
