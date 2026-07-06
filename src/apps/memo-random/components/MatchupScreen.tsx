import { useCountdown } from '../../../shared/hooks/useCountdown';
import type { MatchupSide, MatchupStartPayload, PlayerSheetResult } from '../types';
import { cn } from '../../../shared/utils/cn';
import EmailCard from './EmailCard';

interface MatchupScreenProps {
  matchup: MatchupStartPayload;
  myPlayerId: string;
  myVote: MatchupSide | null;
  locked: boolean;
  readOnly?: boolean;
  onVote: (side: MatchupSide) => void;
  onSubmit: () => void;
}

export default function MatchupScreen({ matchup, myPlayerId, myVote, locked, readOnly = false, onVote, onSubmit }: MatchupScreenProps) {
  const { msRemaining } = useCountdown(matchup.endTimestamp);
  const secondsLeft = matchup.endTimestamp === null ? 'Paused' : Math.ceil(msRemaining / 1000);
  const isOwnMemo = matchup.left.playerId === myPlayerId || matchup.right.playerId === myPlayerId;

  const renderSide = (side: MatchupSide, sheet: PlayerSheetResult) => {
    // If your own memo is up for judgment, you sit this whole round out as a
    // spectator — no voting for either side, not even the other one.
    if (readOnly || isOwnMemo) {
      const isMine = !readOnly && sheet.playerId === myPlayerId;
      return (
        <div className={cn("relative w-full md:flex-1", !readOnly && "opacity-60 cursor-not-allowed")}>
          <EmailCard sheet={sheet} accent="none" />
          {isMine && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-950/70 p-4">
              <p className="text-center text-sm font-bold text-white">
                This is your memo!
              </p>
            </div>
          )}
        </div>
      );
    }
    return (
      <button
        onClick={() => onVote(side)}
        disabled={locked}
        className={cn("w-full md:flex-1 text-left", locked && "cursor-not-allowed", !locked && "cursor-pointer")}
      >
        <EmailCard sheet={sheet} accent={myVote === side ? 'selected' : 'none'} />
      </button>
    );
  };

  return (
    <div className="w-full max-w-md md:max-w-3xl mx-auto space-y-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-gray-400">
          Memo {matchup.matchIndex + 1} of {matchup.totalMatches} — {readOnly ? 'Voting in Progress' : isOwnMemo ? 'Wait for Others to Vote' : 'Pick the Better One'}
        </p>
        <p className={cn("text-4xl font-display font-bold", typeof secondsLeft === 'number' && secondsLeft <= 10 ? "text-red-400" : "text-brodin-accent")}>
          {typeof secondsLeft === 'number' ? `${secondsLeft}s` : 'Paused'}
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-3">
        {renderSide('left', matchup.left)}

        <div className="flex md:flex-col items-center justify-center gap-2.5 md:gap-2 md:px-1">
          <div className="flex-1 md:hidden h-px bg-brodin-primary/30" />
          <span className="font-display text-xs font-bold text-brodin-gold tracking-widest shrink-0">VS</span>
          <div className="flex-1 md:hidden h-px bg-brodin-primary/30" />
        </div>

        {renderSide('right', matchup.right)}
      </div>

      {readOnly || isOwnMemo || locked ? (
        <p className="text-center text-sm text-gray-400">Waiting for other players to vote...</p>
      ) : (
        <button
          onClick={onSubmit}
          disabled={!myVote}
          className="w-full md:max-w-sm md:mx-auto md:block bg-brodin-primary hover:bg-brodin-primaryDark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-3 font-bold transition-colors"
        >
          Submit
        </button>
      )}
    </div>
  );
}
