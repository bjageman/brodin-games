import { describe, it, expect } from 'vitest';
import {
  CARDS_PER_PLAYER, WIRES_IN_DECK, WIRE_WIN_THRESHOLD,
  deckCompositionFor, rebelCountFor, teamCountLabels,
} from './constants';

describe('deckCompositionFor', () => {
  for (let n = 3; n <= 10; n++) {
    it(`deals exactly ${CARDS_PER_PLAYER} cards per player for ${n} players`, () => {
      const { explode, wire, blank, total } = deckCompositionFor(n);
      expect(total).toBe(n * CARDS_PER_PLAYER);
      expect(explode + wire + blank).toBe(total); // no leftover / no shortfall
      expect(blank).toBeGreaterThanOrEqual(0);
    });
  }

  it('uses 1 explode for 3-7 players and 2 for 8-10', () => {
    for (let n = 3; n <= 7; n++) expect(deckCompositionFor(n).explode).toBe(1);
    for (let n = 8; n <= 10; n++) expect(deckCompositionFor(n).explode).toBe(2);
  });

  it('carries WIRES_IN_DECK wires at every player count', () => {
    for (let n = 3; n <= 10; n++) expect(deckCompositionFor(n).wire).toBe(WIRES_IN_DECK);
  });

  // Three rounds only reveal half the deck, so a deck holding exactly
  // WIRE_WIN_THRESHOLD wires would make the peacekeepers' win a ~1% fluke.
  it('holds more wires than the peacekeepers need to cut', () => {
    for (let n = 3; n <= 10; n++) {
      expect(deckCompositionFor(n).wire).toBeGreaterThan(WIRE_WIN_THRESHOLD);
    }
  });

  it('still leaves room for the blanks', () => {
    for (let n = 3; n <= 10; n++) expect(deckCompositionFor(n).blank).toBeGreaterThan(0);
  });
});

describe('teamCountLabels', () => {
  it('prints the exact split at 3-7 players', () => {
    expect(teamCountLabels(7)).toEqual({ rebels: '2', peacekeepers: '5' });
    expect(teamCountLabels(4)).toEqual({ rebels: '1', peacekeepers: '3' });
  });

  // The rebel count is randomised at 8-10, so the table only ever sees the range.
  it('prints a range at 8-10 players', () => {
    expect(teamCountLabels(9)).toEqual({ rebels: '2–3', peacekeepers: '6–7' });
  });

  it('always accounts for every player', () => {
    for (let n = 3; n <= 7; n++) {
      const { rebels, peacekeepers } = teamCountLabels(n);
      expect(Number(rebels) + Number(peacekeepers)).toBe(n);
    }
  });

  // A flipped Opportunist is public: they vacate a peacekeeper seat for a rebel one.
  it('moves a declared Opportunist across', () => {
    expect(teamCountLabels(7, 1)).toEqual({ rebels: '3', peacekeepers: '4' });
    expect(teamCountLabels(9, 1)).toEqual({ rebels: '3–4', peacekeepers: '5–6' });
  });
});

describe('rebelCountFor', () => {
  it('is 1 for 3-4 players', () => {
    expect(rebelCountFor(3)).toBe(1);
    expect(rebelCountFor(4)).toBe(1);
  });

  it('is 2 for 5-7 players', () => {
    for (let n = 5; n <= 7; n++) expect(rebelCountFor(n)).toBe(2);
  });

  it('is 2 or 3 for 8-10 players', () => {
    for (let n = 8; n <= 10; n++) {
      const seen = new Set(Array.from({ length: 200 }, () => rebelCountFor(n)));
      expect([...seen].every((c) => c === 2 || c === 3)).toBe(true);
      expect(seen.size).toBe(2); // both outcomes actually occur
    }
  });
});
