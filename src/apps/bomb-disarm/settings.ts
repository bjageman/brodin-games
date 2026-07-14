import { gameSnapshotKey, loadSnapshot, saveSnapshot } from '../../shared/utils/sessionSnapshot';
import { SPECIAL_CARD_TYPES } from './cards';
import { maxSpecialsFor } from './constants';
import type { SpecialCardType } from './types';

const KEY = 'bombSpecials';

// Host-only: the deck is dealt on the host and reaches everyone else as `hands`,
// so the chosen specials never need to cross the wire.
export function loadSpecials(code: string): SpecialCardType[] {
  const saved = loadSnapshot<Record<string, unknown>>(gameSnapshotKey(code))?.[KEY];
  if (!Array.isArray(saved)) return [...SPECIAL_CARD_TYPES];
  return SPECIAL_CARD_TYPES.filter((t) => saved.includes(t));
}

export function saveSpecials(code: string, specials: SpecialCardType[]) {
  const snapshot = loadSnapshot<Record<string, unknown>>(gameSnapshotKey(code)) ?? {};
  saveSnapshot(gameSnapshotKey(code), { ...snapshot, [KEY]: specials });
}

// A player leaving after the host picked can shrink the deck below what they
// chose, so the cap is re-applied at deal time rather than trusted from storage.
export function specialsForDeal(code: string, playerCount: number): SpecialCardType[] {
  return loadSpecials(code).slice(0, maxSpecialsFor(playerCount));
}
