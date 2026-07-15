import type { Question } from './questions';

export type QuizPhase = 'starting' | 'party' | 'question' | 'reveal' | 'game-over';

export interface PlayerCombat {
  hp: number;
  // Correct answers landed so far — the whole party's win/lose is shared
  // (did the boss go down?), but this decides who wins among the survivors.
  // Exact scoring beyond "count of correct answers" is still open (#82).
  score: number;
}

export interface ActiveRoom {
  index: number;
  isBoss: boolean;
  monsterHp: number;
  monsterMaxHp: number;
  question: Question;
}

// What the reveal screen shows once a round resolves, before the next
// question (same room, if the monster survived) or the next room deals.
export interface RoundResult {
  correctIndex: number;
  answers: Record<string, number>;
  damageDealt: Record<string, number>;
  monsterDamage: number;
  monsterDefeated: boolean;
}

export interface GameState {
  phase: QuizPhase;
  dungeonLength: number;
  room: ActiveRoom | null;
  players: Record<string, PlayerCombat>;
  answers: Record<string, number>;
  roundEndTimestamp: number | null;
  revealEndTimestamp: number | null;
  lastReveal: RoundResult | null;
  // Ids of every question already asked this run, so the same one doesn't
  // repeat if a room takes multiple questions to clear.
  askedQuestionIds: string[];
  // Set once the boss falls — ties are possible and all get listed.
  winnerIds: string[];
}
