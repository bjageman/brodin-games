import type { PlayerInfo } from '../types';

export interface RankedPlayer {
  id: string;
  name: string;
  score: number;
  rank: number; // 1-indexed, handles ties (competition ranking: 1, 1, 3...)
  isWinner: boolean;
}

export interface LeaderboardResult {
  rankedPlayers: RankedPlayer[];
  winners: RankedPlayer[];
  winnerNamesFormatted: string;
  hasTies: boolean;
  topScore: number;
}

/**
 * Computes ranks, winners, and tie information for a leaderboard.
 * @param roster Roster of players in the game.
 * @param scores Map of player ID to score.
 */
export function computeLeaderboard(
  roster: PlayerInfo[],
  scores: Record<string, number>
): LeaderboardResult {
  if (roster.length === 0) {
    return {
      rankedPlayers: [],
      winners: [],
      winnerNamesFormatted: '',
      hasTies: false,
      topScore: 0,
    };
  }

  // 1. Sort roster by score descending
  const sorted = roster
    .map((p) => ({ id: p.id, name: p.name, score: scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const topScore = sorted[0].score;

  // 2. Assign ranks handling ties (standard competition ranking: 1, 1, 3, etc.)
  const rankedPlayers: RankedPlayer[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    
    // If this is not the first player and they have a different score than the previous,
    // update rank to match the index (1-indexed)
    if (i > 0 && current.score !== sorted[i - 1].score) {
      currentRank = i + 1;
    }

    rankedPlayers.push({
      ...current,
      rank: currentRank,
      isWinner: current.score === topScore,
    });
  }

  const winners = rankedPlayers.filter((p) => p.isWinner);
  const hasTies = winners.length > 1;

  // 3. Format winner names nicely: "A", "A & B", or "A, B & C"
  let winnerNamesFormatted = '';
  const winnerNames = winners.map((w) => w.name);
  if (winnerNames.length === 1) {
    winnerNamesFormatted = winnerNames[0];
  } else if (winnerNames.length === 2) {
    winnerNamesFormatted = `${winnerNames[0]} & ${winnerNames[1]}`;
  } else if (winnerNames.length > 2) {
    const last = winnerNames.pop();
    winnerNamesFormatted = `${winnerNames.join(', ')} & ${last}`;
  }

  return {
    rankedPlayers,
    winners,
    winnerNamesFormatted,
    hasTies,
    topScore,
  };
}
