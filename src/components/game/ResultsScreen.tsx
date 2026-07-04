import type { PlayerSheetResult } from '../../types';

interface ResultsScreenProps {
  sheets: Record<string, PlayerSheetResult>;
  isHost: boolean;
  onPlayAgain?: () => void;
}

export default function ResultsScreen({ sheets, isHost, onPlayAgain }: ResultsScreenProps) {
  const entries = Object.values(sheets);

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <h2 className="text-center font-display text-lg font-bold text-brodin-gold uppercase tracking-wide">
        Everyone's Ad-libs
      </h2>

      {entries.length === 0 && (
        <p className="text-center text-sm text-gray-400">No sheets were submitted this round.</p>
      )}

      <div className="space-y-3">
        {entries.map((sheet) => (
          <div key={sheet.playerId} className="bg-brodin-panel border border-brodin-primary/30 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-brodin-accent font-bold mb-1">{sheet.playerName}</p>
            <p className="text-sm leading-relaxed text-gray-100">{sheet.renderedText}</p>
          </div>
        ))}
      </div>

      {isHost && onPlayAgain && (
        <button
          onClick={onPlayAgain}
          className="w-full bg-brodin-primary hover:bg-brodin-primaryDark text-white rounded-lg py-3 font-bold transition-colors"
        >
          Play Again
        </button>
      )}
    </div>
  );
}
