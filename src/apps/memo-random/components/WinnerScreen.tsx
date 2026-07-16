import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import type { PlayerSheetResult } from '../types';
import { cn } from '../../../shared/utils/cn';
import { computeLeaderboard } from '../../../shared/utils/leaderboard';
import EmailCard from './EmailCard';

const CONFETTI_COLORS = ['#7c3aed', '#22d3ee', '#facc15'];

interface WinnerScreenProps {
  sheets: Record<string, PlayerSheetResult>;
  winnerPlayerIds: string[];
  scores: Record<string, number>;
  isHost: boolean;
  isConnected: boolean;
  onPlayAgain: () => void;
  onEndSession: () => void;
  onDisconnect: () => void;
}

export default function WinnerScreen({
  sheets,
  winnerPlayerIds,
  scores,
  isHost,
  isConnected,
  onPlayAgain,
  onEndSession,
  onDisconnect,
}: WinnerScreenProps) {
  const winners = winnerPlayerIds.map((id) => sheets[id]).filter((s): s is PlayerSheetResult => !!s);
  const formatContributors = (names: string[]) =>
    names.length === 2 ? `${names[0]} and ${names[1]}` : names.join(', ');

  const roster = Object.keys(scores).map((id) => ({
    id,
    name: sheets[id]?.playerName ?? 'Unknown',
  }));
  const { rankedPlayers, winnerNamesFormatted, hasTies } = computeLeaderboard(roster, scores);

  useEffect(() => {
    if (winners.length === 0) return;
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.4 }, colors: CONFETTI_COLORS });
  }, [winners.length]);

  return (
    <div className="w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto space-y-4">
      <h2 className="text-center font-display text-lg font-bold text-brodin-gold uppercase tracking-wide">
        {winners.length === 0 ? 'No Scores Recorded' : hasTies ? `Tie: ${winnerNamesFormatted}` : `Winner: ${winnerNamesFormatted}`}
      </h2>

      {winners.length === 0 && (
        <p className="text-center text-sm text-gray-400">Nobody submitted a memo this round.</p>
      )}

      <div className="space-y-3">
        {winners.map((sheet) => (
          <div key={sheet.playerId} className="space-y-1">
            <EmailCard
              sheet={sheet}
              accent="winner"
              badge={
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-brodin-gold/90 text-gray-900">
                  {scores[sheet.playerId] ?? 0} pts
                </span>
              }
            />
            {sheet.contributors.length > 0 && (
              <p className="text-xs text-gray-400 text-center">
                Word list by {formatContributors(sheet.contributors)}
              </p>
            )}
          </div>
        ))}
      </div>

      {rankedPlayers.length > 0 && (
        <div className="bg-brodin-panel border border-brodin-primary/30 rounded-xl p-4 space-y-1.5">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Final Scoreboard</p>
          {rankedPlayers.map((p) => (
            <div
              key={p.id}
              className={cn(
                "flex justify-between text-sm",
                p.isWinner ? "text-brodin-gold font-bold" : "text-gray-300"
              )}
            >
              <span>#{p.rank} {p.name}</span>
              <span>{p.score} pts</span>
            </div>
          ))}
        </div>
      )}

      {isHost ? (
        <div className="space-y-2">
          <button
            onClick={onPlayAgain}
            disabled={!isConnected}
            className="w-full bg-brodin-primary hover:bg-brodin-primaryDark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-3 font-bold transition-colors"
          >
            {isConnected ? 'Play Again' : 'Reconnecting...'}
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
