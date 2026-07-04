import type { PlayerSheetResult } from '../../types';

interface WinnerScreenProps {
  sheets: Record<string, PlayerSheetResult>;
  winnerPlayerIds: string[];
  votes: Record<string, number>;
  isHost: boolean;
  onPlayAgain: () => void;
  onEndSession: () => void;
  onDisconnect: () => void;
}

export default function WinnerScreen({
  sheets,
  winnerPlayerIds,
  votes,
  isHost,
  onPlayAgain,
  onEndSession,
  onDisconnect,
}: WinnerScreenProps) {
  const winners = winnerPlayerIds.map((id) => sheets[id]).filter((s): s is PlayerSheetResult => !!s);

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <h2 className="text-center font-display text-lg font-bold text-brodin-gold uppercase tracking-wide">
        {winners.length === 0 ? 'No Votes Cast' : winners.length > 1 ? "It's a Tie!" : 'Winner!'}
      </h2>

      {winners.length === 0 && (
        <p className="text-center text-sm text-gray-400">Nobody voted this round.</p>
      )}

      <div className="space-y-3">
        {winners.map((sheet) => {
          const count = votes[sheet.playerId] ?? 0;
          return (
            <div key={sheet.playerId} className="bg-brodin-panel border border-brodin-accent rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-brodin-accent font-bold mb-1">
                {sheet.playerName} · {count} vote{count === 1 ? '' : 's'}
              </p>
              <p className="text-sm leading-relaxed text-gray-100">{sheet.renderedText}</p>
            </div>
          );
        })}
      </div>

      {isHost ? (
        <div className="space-y-2">
          <button
            onClick={onPlayAgain}
            className="w-full bg-brodin-primary hover:bg-brodin-primaryDark text-white rounded-lg py-3 font-bold transition-colors"
          >
            Play Again
          </button>
          <button
            onClick={onEndSession}
            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg py-3 font-bold transition-colors"
          >
            End Session
          </button>
        </div>
      ) : (
        <button onClick={onDisconnect} className="w-full text-center text-sm text-gray-400 underline">
          Disconnect
        </button>
      )}
    </div>
  );
}
