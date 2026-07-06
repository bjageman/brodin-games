export type FakeItPhase = 'starting' | 'role-reveal' | 'drawing' | 'voting' | 'results' | 'leaderboard';

export interface Point {
  x: number;
  y: number;
}

export interface Line {
  playerId: string;
  playerName: string;
  color: string;
  points: Point[];
}

export interface Topic {
  name: string;
  category: string;
}

export interface GameState {
  phase: FakeItPhase;
  imposterId: string;
  topic: Topic | null; // Null for the imposter so they don't see it!
  drawerIndex: number;
  drawingRound: number;
  lines: Line[];
  votes: Record<string, string>; // voterId -> votedId
  scores: Record<string, number>; // playerId -> cumulative score
  roundPoints: Record<string, number>; // playerId -> points earned in the current round
  roleRevealEndTimestamp: number | null;
  turnEndTimestamp: number | null;
  voteEndTimestamp: number | null;
}
