import { gameSnapshotKey, loadSnapshot, saveSnapshot } from '../../shared/utils/sessionSnapshot';
import { SPECIAL_CARD_TYPES } from './cards';
import { maxSpecialsFor } from './constants';
import { SPECIAL_ROLES } from './roles';
import type { SpecialCardType, SpecialRole } from './types';

const CARDS_KEY = 'bombSpecials';
const ROLES_KEY = 'bombSpecialRoles';

// Host-only: the deck and the roles are both dealt on the host and reach
// everyone else inside the broadcast game state, so these never cross the wire.
function load<T extends string>(code: string, key: string, all: T[]): T[] {
  const saved = loadSnapshot<Record<string, unknown>>(gameSnapshotKey(code))?.[key];
  if (!Array.isArray(saved)) return [...all];
  return all.filter((t) => saved.includes(t));
}

function save(code: string, key: string, value: string[]) {
  const snapshot = loadSnapshot<Record<string, unknown>>(gameSnapshotKey(code)) ?? {};
  saveSnapshot(gameSnapshotKey(code), { ...snapshot, [key]: value });
}

export const loadSpecials = (code: string) => load(code, CARDS_KEY, SPECIAL_CARD_TYPES);
export const saveSpecials = (code: string, v: SpecialCardType[]) => save(code, CARDS_KEY, v);

export const loadSpecialRoles = (code: string) => load(code, ROLES_KEY, SPECIAL_ROLES);
export const saveSpecialRoles = (code: string, v: SpecialRole[]) => save(code, ROLES_KEY, v);

// A player leaving after the host picked can shrink the table below what they
// chose, so the caps are re-applied at deal time rather than trusted from storage.
export function specialsForDeal(code: string, playerCount: number): SpecialCardType[] {
  return loadSpecials(code).slice(0, maxSpecialsFor(playerCount));
}

// Unlike the special cards (a single shared budget), the rebel and peacekeeper
// special-role seats are two separate budgets — assignRoles caps each one against
// the actual roster at deal time, so there's nothing to slice here.
export function specialRolesForDeal(code: string): SpecialRole[] {
  return loadSpecialRoles(code);
}
