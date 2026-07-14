import { describe, it, expect } from 'vitest';
import { buildDeck, dealHands, redeal, swapCards } from './deck';
import { CARDS_PER_PLAYER, WIRES_IN_DECK, maxSpecialsFor, deckCompositionFor } from './constants';
import { SPECIAL_CARD_TYPES, isSpecial } from './cards';
import type { Card, CardType } from './types';

const ALL_SPECIALS = [...SPECIAL_CARD_TYPES];

describe('maxSpecialsFor', () => {
  it('always leaves at least one blank behind', () => {
    for (let n = 3; n <= 10; n++) {
      expect(deckCompositionFor(n, maxSpecialsFor(n)).blank).toBe(1);
    }
  });

  it('has no room for all six specials at 3 players', () => {
    expect(maxSpecialsFor(3)).toBeLessThan(ALL_SPECIALS.length);
  });

  it('fits all six from 5 players up', () => {
    for (let n = 5; n <= 10; n++) {
      expect(maxSpecialsFor(n)).toBeGreaterThanOrEqual(ALL_SPECIALS.length);
    }
  });
});

describe('buildDeck', () => {
  it('deals a full deck at every player count, with or without specials', () => {
    for (let n = 3; n <= 10; n++) {
      for (const specials of [[], ALL_SPECIALS]) {
        const deck = buildDeck(n, specials);
        expect(deck).toHaveLength(n * CARDS_PER_PLAYER);
        expect(deck.filter((c) => c === 'wire')).toHaveLength(WIRES_IN_DECK);
        expect(deck.filter((c) => c === 'explode').length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  // Specials come out of the blanks, so the wire count — and the win odds that
  // were balanced around it — must not move when they're switched on.
  it('takes specials out of the blanks, never the wires', () => {
    const plain = buildDeck(6, []);
    const withSpecials = buildDeck(6, ALL_SPECIALS);
    expect(withSpecials.filter((c) => c === 'wire')).toHaveLength(plain.filter((c) => c === 'wire').length);
    expect(withSpecials.filter(isSpecial)).toHaveLength(ALL_SPECIALS.length);
    expect(withSpecials.filter((c) => c === 'blank').length)
      .toBe(plain.filter((c) => c === 'blank').length - ALL_SPECIALS.length);
  });

  it('never puts the same special in twice', () => {
    const deck = buildDeck(8, ALL_SPECIALS);
    const specials = deck.filter(isSpecial);
    expect(new Set(specials).size).toBe(specials.length);
  });

  it('clamps to what a small deck can hold', () => {
    const deck = buildDeck(3, ALL_SPECIALS);
    expect(deck).toHaveLength(3 * CARDS_PER_PLAYER);
    expect(deck.filter(isSpecial)).toHaveLength(maxSpecialsFor(3));
    expect(deck.filter((c) => c === 'blank').length).toBeGreaterThan(0);
  });
});

describe('dealHands', () => {
  it('gives everyone a full hand', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const hands = dealHands(ids, buildDeck(4, ALL_SPECIALS));
    ids.forEach((id) => {
      expect(hands[id]).toHaveLength(CARDS_PER_PLAYER);
      expect(hands[id].every((c) => !c.revealed)).toBe(true);
    });
  });
});

const card = (type: CardType, revealed = false): Card => ({ type, revealed });

describe('redeal', () => {
  const ids = ['a', 'b', 'c'];

  it('drops the revealed cards and shrinks the hands', () => {
    const hands = {
      a: [card('wire', true), card('blank'), card('blank')],
      b: [card('blank', true), card('wire'), card('blank')],
      c: [card('blank'), card('blank'), card('explode')],
    };
    const next = redeal(ids, hands, []);
    const all = ids.flatMap((id) => next[id]);
    expect(all).toHaveLength(7); // 9 dealt, 2 revealed and gone
    expect(all.every((c) => !c.revealed)).toBe(true);
  });

  it('keeps the surviving cards, not just the count', () => {
    const hands = {
      a: [card('explode'), card('wire', true)],
      b: [card('wire'), card('blank')],
      c: [card('interrogate'), card('blank')],
    };
    const next = redeal(ids, hands, []);
    const all = ids.flatMap((id) => next[id]).map((c) => c.type).sort();
    expect(all).toEqual(['blank', 'blank', 'explode', 'interrogate', 'wire']);
  });

  it('folds a repair kit’s addition into the next deal', () => {
    const hands = { a: [card('blank')], b: [card('blank')], c: [card('blank')] };
    const next = redeal(ids, hands, ['explode']);
    const all = ids.flatMap((id) => next[id]);
    expect(all).toHaveLength(4);
    expect(all.filter((c) => c.type === 'explode')).toHaveLength(1);
  });
});

describe('swapCards', () => {
  it('exchanges two cards between two players', () => {
    const hands = {
      a: [card('explode'), card('blank')],
      b: [card('wire'), card('blank')],
    };
    const next = swapCards(hands, { playerId: 'a', cardIndex: 0 }, { playerId: 'b', cardIndex: 0 });
    expect(next.a[0].type).toBe('wire');
    expect(next.b[0].type).toBe('explode');
    expect(next.a[1].type).toBe('blank');
  });

  it('leaves the original hands untouched', () => {
    const hands = { a: [card('explode')], b: [card('wire')] };
    swapCards(hands, { playerId: 'a', cardIndex: 0 }, { playerId: 'b', cardIndex: 0 });
    expect(hands.a[0].type).toBe('explode');
    expect(hands.b[0].type).toBe('wire');
  });
});
