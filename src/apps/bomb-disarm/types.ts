export type BombPhase = 'starting' | 'role-reveal' | 'memorize' | 'table' | 'results';

export type CardType = 'blank' | 'wire' | 'explode';

export type Role = 'rebel' | 'peacekeeper';

export type Winner = 'rebels' | 'peacekeepers';

export interface Card {
  type: CardType;
  revealed: boolean;
}

// Broadcast alongside each reveal so every phone can show what was just flipped
// (only the owner's phone renders the actual card face; others just need the news).
export interface LastReveal {
  targetId: string;
  targetName: string;
  cardIndex: number;
  type: CardType;
}

export interface GameState {
  phase: BombPhase;
  round: number;
  revealsThisRound: number;
  // Holds the verdict while the winning card sits face-up; `winner` lands after.
  pendingWinner: Winner | null;
  // Both roles and hands are broadcast in full (ntfy is a shared channel, same
  // as memo-random's round-2 assignments) — the UI only ever renders the slice
  // a given device is allowed to see. Not cheat-proof against devtools; fine
  // for a party game played around one table.
  roles: Record<string, Role>;
  hands: Record<string, Card[]>;
  activePlayerId: string;
  wiresRevealed: number;
  // Monotonic turn counter — a reveal is stamped with the turn it acted on so a
  // duplicate/echoed/late tap for an already-resolved turn is ignored.
  turn: number;
  roleRevealEndTimestamp: number | null;
  memorizeEndTimestamp: number | null;
  winner: Winner | null;
  lastReveal: LastReveal | null;
}
