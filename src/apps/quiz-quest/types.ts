import type { Question } from './questions';

export type QuizPhase = 'starting' | 'party' | 'question' | 'reveal' | 'game-over';

export interface PlayerCombat {
  hp: number;
  // Correct answers landed so far (see #82 for the boss-room bonus) — the
  // whole party's win/lose is shared (did the boss go down?), but this
  // decides who wins among the survivors.
  score: number;
  // Hit 0 HP: they keep answering and scoring but no longer land damage on
  // the monster. Revived to 1 HP whenever the party clears a room (#80).
  isGhost: boolean;
  // Ward count (0-2, see MAX_ITEMS) — the mockup's two item slots. Each Ward
  // absorbs one wrong answer's damage before being consumed. Earned as room
  // loot, given to whoever's furthest behind on points (#84).
  items: number;
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
  // Ids of players whose Ward absorbed a wrong answer this round.
  wardsUsed: string[];
  // Whoever the room's loot went to, if the room was cleared this round.
  lootRecipientId: string | null;
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
