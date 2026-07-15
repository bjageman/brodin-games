export const CARDS_PER_PLAYER = 6;
export const ROUNDS = 3;

export const ROLE_REVEAL_DURATION_MS = 6000;
export const MEMORIZE_DURATION_MS = 60000;
export const RESULT_REVEAL_DELAY_MS = 5000;
// How long a User Manual holds a card face-up for the table before it turns back.
export const PEEK_DURATION_MS = 5000;

export const WIRE_WIN_THRESHOLD = 6;

// A client that missed the host's one-shot state broadcast (its message handler
// wasn't registered yet when it landed) pulls current state on a retry loop.
export const STATE_REQUEST_RETRY_INTERVAL_MS = 1000;
export const STATE_REQUEST_MAX_ATTEMPTS = 10;

// Three rounds only reveal half the deck, so it must carry more wires than the
// 6 you need. At 12 the odds of cutting 6 hold at 63-69% for any player count.
export const WIRES_IN_DECK = 12;

export function deckCompositionFor(
  playerCount: number,
  specialCount = 0,
): {
  explode: number;
  wire: number;
  special: number;
  blank: number;
  total: number;
} {
  const total = playerCount * CARDS_PER_PLAYER;
  const explode = playerCount <= 7 ? 1 : 2;
  const wire = WIRES_IN_DECK;
  const special = Math.min(specialCount, maxSpecialsFor(playerCount));
  const blank = total - explode - wire - special;
  return { explode, wire, special, blank, total };
}

// Specials are cut out of the blanks, so a small table can't hold all six: a
// 3-player deck is 18 cards and 13 of them are already the bomb and the wires.
// One blank is always left behind so the deck never turns into all-consequences.
export function maxSpecialsFor(playerCount: number): number {
  const total = playerCount * CARDS_PER_PLAYER;
  const explode = playerCount <= 7 ? 1 : 2;
  return Math.max(0, total - explode - WIRES_IN_DECK - 1);
}

// Rebels: 1 for 3-4 players, 2 for 5-7, and a hidden 2-or-3 for 8-10 so the
// rebels can never be sure exactly how many allies they have.
export function rebelCountFor(playerCount: number): number {
  if (playerCount <= 4) return 1;
  if (playerCount <= 7) return 2;
  return Math.random() < 0.5 ? 2 : 3;
}

// What the table's team counter is allowed to print. Below 8 the count is fixed
// by the player count anyway; at 8-10 it's randomised, so null means "show the
// range" rather than handing the rebels their own headcount.
export function knownRebelCountFor(playerCount: number): number | null {
  return playerCount <= 7 ? rebelCountFor(playerCount) : null;
}

const HIDDEN_REBEL_RANGE = [2, 3];

// `extraRebels` is the Opportunist once they've flipped to the rebels: they took
// a peacekeeper's seat at deal time, and the flip is public, so the counter has
// to move with them.
export function teamCountLabels(playerCount: number, extraRebels = 0): { rebels: string; peacekeepers: string } {
  const known = knownRebelCountFor(playerCount);
  if (known !== null) {
    const rebels = known + extraRebels;
    return { rebels: String(rebels), peacekeepers: String(playerCount - rebels) };
  }
  const [lo, hi] = HIDDEN_REBEL_RANGE.map((n) => n + extraRebels);
  return { rebels: `${lo}–${hi}`, peacekeepers: `${playerCount - hi}–${playerCount - lo}` };
}
