import { useCountdown } from '../../hooks/useCountdown';
import type { PlayerSheetResult } from '../../types';
import { cn } from '../../utils/cn';

interface VotingScreenProps {
  endTimestamp: number;
  sheets: Record<string, PlayerSheetResult>;
  myVote: string | null;
  locked: boolean;
  onVote: (targetPlayerId: string) => void;
  onSubmit: () => void;
}

export default function VotingScreen({ endTimestamp, sheets, myVote, locked, onVote, onSubmit }: VotingScreenProps) {
  const { msRemaining } = useCountdown(endTimestamp);
  const secondsLeft = Math.ceil(msRemaining / 1000);
  const entries = Object.values(sheets);

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <div className="text-center">
        <h2 className="font-display text-lg font-bold text-brodin-gold uppercase tracking-wide">
          Select Your Favorite
        </h2>
        <p className={cn("text-4xl font-display font-bold", secondsLeft <= 10 ? "text-red-400" : "text-brodin-accent")}>
          {secondsLeft}s
        </p>
      </div>

      {entries.length === 0 && (
        <p className="text-center text-sm text-gray-400">No sheets were submitted this round.</p>
      )}

      <div className="space-y-3">
        {entries.map((sheet) => {
          const selected = myVote === sheet.playerId;
          return (
            <button
              key={sheet.playerId}
              onClick={() => onVote(sheet.playerId)}
              disabled={locked}
              className={cn(
                "w-full text-left rounded-xl p-4 border transition-colors",
                selected
                  ? "bg-brodin-primary/20 border-brodin-accent"
                  : "bg-brodin-panel border-brodin-primary/30 hover:border-brodin-primary/60",
                locked && "opacity-60 cursor-not-allowed"
              )}
            >
              <p className="text-xs uppercase tracking-wide text-brodin-accent font-bold mb-1">{sheet.playerName}</p>
              <p className="text-sm leading-relaxed text-gray-100">{sheet.renderedText}</p>
            </button>
          );
        })}
      </div>

      {locked ? (
        <p className="text-center text-sm text-gray-400">Waiting for other players to vote...</p>
      ) : (
        <button
          onClick={onSubmit}
          disabled={!myVote}
          className="w-full bg-brodin-primary hover:bg-brodin-primaryDark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-3 font-bold transition-colors"
        >
          Submit
        </button>
      )}
    </div>
  );
}
