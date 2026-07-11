import { describe, it, expect } from 'vitest';
import { CARDS_PER_PLAYER, deckCompositionFor, rebelCountFor } from './constants';

describe('deckCompositionFor', () => {
  for (let n = 3; n <= 10; n++) {
    it(`deals exactly ${CARDS_PER_PLAYER} cards per player for ${n} players`, () => {
      const { explode, wire, blank, total } = deckCompositionFor(n);
      expect(total).toBe(n * CARDS_PER_PLAYER);
      expect(explode + wire + blank).toBe(total); // no leftover / no shortfall
      expect(blank).toBeGreaterThanOrEqual(0);
    });
  }

  it('uses 1 explode + 6 wires for 3-7 players', () => {
    for (let n = 3; n <= 7; n++) {
      const { explode, wire } = deckCompositionFor(n);
      expect(explode).toBe(1);
      expect(wire).toBe(6);
    }
  });

  it('uses 2 explode + 8 wires for 8-10 players', () => {
    for (let n = 8; n <= 10; n++) {
      const { explode, wire } = deckCompositionFor(n);
      expect(explode).toBe(2);
      expect(wire).toBe(8);
    }
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
