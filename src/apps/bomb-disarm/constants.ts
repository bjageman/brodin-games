export const CARDS_PER_PLAYER = 6;

export const ROLE_REVEAL_DURATION_MS = 6000;   // show your team before the deal
export const MEMORIZE_DURATION_MS = 60000;     // 60s to study your hand before it flips down

// Peacekeepers always win at exactly 6 cut wires, regardless of player count
// (big decks carry 8 wire cards, but only 6 are ever needed to disarm).
export const WIRE_WIN_THRESHOLD = 6;

// A client that missed the host's one-shot state broadcast (its message handler
// wasn't registered yet when it landed) pulls current state on a retry loop.
export const STATE_REQUEST_RETRY_INTERVAL_MS = 1000;
export const STATE_REQUEST_MAX_ATTEMPTS = 10;

// Deck: explode + wire + enough blanks that every player gets exactly 6 cards.
export function deckCompositionFor(playerCount: number): {
  explode: number;
  wire: number;
  blank: number;
  total: number;
} {
  const total = playerCount * CARDS_PER_PLAYER;
  const explode = playerCount <= 7 ? 1 : 2;
  const wire = playerCount <= 7 ? 6 : 8;
  const blank = total - explode - wire;
  return { explode, wire, blank, total };
}

// Rebels: 1 for 3-4 players, 2 for 5-7, and a hidden 2-or-3 for 8-10 so the
// rebels can never be sure exactly how many allies they have.
export function rebelCountFor(playerCount: number): number {
  if (playerCount <= 4) return 1;
  if (playerCount <= 7) return 2;
  return Math.random() < 0.5 ? 2 : 3;
}
