import { CARDS_PER_PLAYER, deckCompositionFor } from './constants';
import type { Card, CardRef, CardType, SpecialCardType } from './types';

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Double Agent needs a hidden rebel-count draw to swap into, which only exists
// at 8+ players — below that it's dropped rather than dealt in as a no-op.
export function buildDeck(playerCount: number, specials: SpecialCardType[], folkHeroInPlay = false): CardType[] {
  const eligible = specials.filter((t) => t !== 'double-agent' || playerCount >= 8);
  const { explode, wire, special, blank } = deckCompositionFor(playerCount, eligible.length, folkHeroInPlay);
  return shuffle([
    ...Array<CardType>(explode).fill('explode'),
    ...Array<CardType>(wire).fill('wire'),
    ...eligible.slice(0, special),
    ...Array<CardType>(blank).fill('blank'),
  ]);
}

export function dealHands(playerIds: string[], deck: CardType[]): Record<string, Card[]> {
  const hands: Record<string, Card[]> = {};
  playerIds.forEach((id, i) => {
    hands[id] = deck
      .slice(i * CARDS_PER_PLAYER, i * CARDS_PER_PLAYER + CARDS_PER_PLAYER)
      .map((type) => ({ type, revealed: false }));
  });
  return hands;
}

// Between rounds the revealed cards are gone for good. What's left is reshuffled
// with anything a Repair Kit added and dealt back out round-robin, so hands
// shrink as the game goes.
export function redeal(
  playerIds: string[],
  hands: Record<string, Card[]>,
  additions: CardType[],
): Record<string, Card[]> {
  const leftovers = shuffle([
    ...playerIds.flatMap((id) => (hands[id] ?? []).filter((c) => !c.revealed)),
    ...additions.map((type) => ({ type, revealed: false })),
  ]);
  const next: Record<string, Card[]> = {};
  playerIds.forEach((id) => { next[id] = []; });
  leftovers.forEach((card, i) => { next[playerIds[i % playerIds.length]].push(card); });
  return next;
}

export function swapCards(hands: Record<string, Card[]>, a: CardRef, b: CardRef): Record<string, Card[]> {
  const handA = [...(hands[a.playerId] ?? [])];
  const handB = [...(hands[b.playerId] ?? [])];
  const held = handA[a.cardIndex];
  handA[a.cardIndex] = handB[b.cardIndex];
  handB[b.cardIndex] = held;
  return { ...hands, [a.playerId]: handA, [b.playerId]: handB };
}
