export type BombPhase = 'starting' | 'role-reveal' | 'memorize' | 'table' | 'results';

export type SpecialCardType =
  | 'silence'
  | 'interrogate'
  | 'rogue-agent'
  | 'user-manual'
  | 'crossed-wires'
  | 'repair-kit';

export type CardType = 'blank' | 'wire' | 'explode' | SpecialCardType;

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

// A card slot anywhere on the table.
export interface CardRef {
  playerId: string;
  cardIndex: number;
}

// A special card that needs its revealer to make a choice before play resumes.
// `actorId` is whoever flipped it — they pick up their own phone to answer.
export interface PendingEffect {
  type: 'interrogate' | 'user-manual' | 'crossed-wires' | 'repair-kit';
  actorId: string;
  // Crossed Wires needs two picks; the first is parked here while it waits.
  firstPick: CardRef | null;
  // Interrogate's answer. Broadcast like everything else, but only ever drawn on
  // the actor's phone — the same trust model as roles and hands.
  role: Role | null;
  roleTargetName: string | null;
}

// User Manual: a card held face-up for the table, then turned back over. It is
// never marked revealed, so it stays in the deck and its action never fires.
export interface Peek {
  card: CardRef;
  type: CardType;
  ownerName: string;
  endTimestamp: number;
}

// What the actor sends back to the host to satisfy a PendingEffect.
export type EffectChoice =
  | { kind: 'player'; playerId: string }
  | { kind: 'card'; playerId: string; cardIndex: number }
  | { kind: 'repair'; cardType: 'explode' | 'wire' }
  | { kind: 'done' };

export interface GameState {
  phase: BombPhase;
  round: number;
  revealsThisRound: number;
  // Holds the verdict while the winning card sits face-up; `winner` lands after.
  pendingWinner: Winner | null;
  pendingEffect: PendingEffect | null;
  peek: Peek | null;
  // Rogue Agent: this player chooses every card for the rest of the round.
  rogueAgentId: string | null;
  // Repair Kit's secret additions, folded into next round's deal.
  deckAdditions: CardType[];
  // Public note about the last special that resolved ("Ann interrogated Bob").
  effectNote: string | null;
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
