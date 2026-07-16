import { describe, it, expect } from 'vitest';
import { computeLeaderboard } from './leaderboard';
import type { PlayerInfo } from '../types';

describe('computeLeaderboard', () => {
  const roster: PlayerInfo[] = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
    { id: '4', name: 'David' },
  ];

  it('handles empty roster', () => {
    const res = computeLeaderboard([], {});
    expect(res.rankedPlayers).toEqual([]);
    expect(res.winners).toEqual([]);
    expect(res.winnerNamesFormatted).toBe('');
    expect(res.hasTies).toBe(false);
    expect(res.topScore).toBe(0);
  });

  it('handles single winner', () => {
    const scores = { '1': 100, '2': 80, '3': 60, '4': 40 };
    const res = computeLeaderboard(roster, scores);

    expect(res.topScore).toBe(100);
    expect(res.hasTies).toBe(false);
    expect(res.winnerNamesFormatted).toBe('Alice');
    expect(res.winners).toHaveLength(1);
    expect(res.winners[0].name).toBe('Alice');

    expect(res.rankedPlayers).toEqual([
      { id: '1', name: 'Alice', score: 100, rank: 1, isWinner: true },
      { id: '2', name: 'Bob', score: 80, rank: 2, isWinner: false },
      { id: '3', name: 'Charlie', score: 60, rank: 3, isWinner: false },
      { id: '4', name: 'David', score: 40, rank: 4, isWinner: false },
    ]);
  });

  it('handles tie at the top (two winners)', () => {
    const scores = { '1': 100, '2': 100, '3': 60, '4': 40 };
    const res = computeLeaderboard(roster, scores);

    expect(res.topScore).toBe(100);
    expect(res.hasTies).toBe(true);
    expect(res.winnerNamesFormatted).toBe('Alice & Bob');
    expect(res.winners).toHaveLength(2);

    expect(res.rankedPlayers).toEqual([
      { id: '1', name: 'Alice', score: 100, rank: 1, isWinner: true },
      { id: '2', name: 'Bob', score: 100, rank: 1, isWinner: true },
      { id: '3', name: 'Charlie', score: 60, rank: 3, isWinner: false },
      { id: '4', name: 'David', score: 40, rank: 4, isWinner: false },
    ]);
  });

  it('handles tie at the top (three winners)', () => {
    const scores = { '1': 100, '2': 100, '3': 100, '4': 40 };
    const res = computeLeaderboard(roster, scores);

    expect(res.topScore).toBe(100);
    expect(res.hasTies).toBe(true);
    expect(res.winnerNamesFormatted).toBe('Alice, Bob & Charlie');
    expect(res.winners).toHaveLength(3);

    expect(res.rankedPlayers).toEqual([
      { id: '1', name: 'Alice', score: 100, rank: 1, isWinner: true },
      { id: '2', name: 'Bob', score: 100, rank: 1, isWinner: true },
      { id: '3', name: 'Charlie', score: 100, rank: 1, isWinner: true },
      { id: '4', name: 'David', score: 40, rank: 4, isWinner: false },
    ]);
  });

  it('handles ties in the middle of the leaderboard', () => {
    const scores = { '1': 120, '2': 100, '3': 100, '4': 80 };
    const res = computeLeaderboard(roster, scores);

    expect(res.topScore).toBe(120);
    expect(res.hasTies).toBe(false);
    expect(res.winnerNamesFormatted).toBe('Alice');

    expect(res.rankedPlayers).toEqual([
      { id: '1', name: 'Alice', score: 120, rank: 1, isWinner: true },
      { id: '2', name: 'Bob', score: 100, rank: 2, isWinner: false },
      { id: '3', name: 'Charlie', score: 100, rank: 2, isWinner: false },
      { id: '4', name: 'David', score: 80, rank: 4, isWinner: false },
    ]);
  });
});
