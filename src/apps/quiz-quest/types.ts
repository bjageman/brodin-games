// Scaffolding only — the dungeon/room loop lands in a follow-up (see #79-82).
export type QuizPhase = 'starting' | 'party';

export interface GameState {
  phase: QuizPhase;
}
