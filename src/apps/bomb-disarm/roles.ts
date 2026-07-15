import { rebelCountFor } from './constants';
import { shuffle } from './deck';
import type { GameState, Role, SpecialRole, Winner } from './types';

export const SPECIAL_ROLES: SpecialRole[] = ['procrastinator', 'opportunist', 'folk-hero'];

export const SPECIAL_ROLE_META: Record<SpecialRole, { title: string; icon: string; blurb: string }> = {
  procrastinator: {
    title: 'Procrastinator',
    icon: '🐌',
    blurb: 'You want the clock to run out. You win only if round 3 ends with no bomb revealed and fewer than 6 wires cut — a bomb going off or the last wire being cut is a loss for you.',
  },
  opportunist: {
    title: 'Opportunist',
    icon: '🎭',
    blurb: 'On your turn you may flip your card on the table and publicly pick a side. You must do it before the game ends, or you lose.',
  },
  'folk-hero': {
    title: 'Folk Hero',
    icon: '🦸',
    blurb: 'A peacekeeper. If a bomb is revealed you may reveal yourself to keep the game alive — but you take no more turns after that.',
  },
};

// A special role takes a peacekeeper's seat, never a rebel's, so the rebel count
// (and the win balance tuned around it) is the same whether these are on or off.
// One plain peacekeeper is always left over.
export function maxSpecialRolesFor(playerCount: number): number {
  const rebels = playerCount <= 4 ? 1 : playerCount <= 7 ? 2 : 3;
  return Math.max(0, Math.min(SPECIAL_ROLES.length, playerCount - rebels - 1));
}

export function assignRoles(playerIds: string[], enabled: SpecialRole[]): {
  roles: Record<string, Role>;
  specialRoles: Record<string, SpecialRole>;
} {
  const order = shuffle(playerIds);
  const rebelCount = rebelCountFor(playerIds.length);
  const rebels = new Set(order.slice(0, rebelCount));

  const roles: Record<string, Role> = {};
  playerIds.forEach((id) => { roles[id] = rebels.has(id) ? 'rebel' : 'peacekeeper'; });

  const specialRoles: Record<string, SpecialRole> = {};
  const seats = order.slice(rebelCount);
  enabled.slice(0, maxSpecialRolesFor(playerIds.length)).forEach((role, i) => {
    if (seats[i]) specialRoles[seats[i]] = role;
  });

  return { roles, specialRoles };
}

// `winner` is a side ('rebels'), a player's role is singular ('rebel') — they are
// not the same string and must never be compared directly.
export function winningRole(winner: Winner): Role {
  return winner === 'rebels' ? 'rebel' : 'peacekeeper';
}

// The Procrastinator only ever wins on the clock, and the Opportunist only if
// they committed to the winning side in time. Everyone else rides their team.
export function didWin(playerId: string, state: GameState): boolean {
  if (!state.winner) return false;
  const special = state.specialRoles[playerId];
  if (special === 'procrastinator') return state.endReason === 'timeout';
  const winning = winningRole(state.winner);
  // An Opportunist who never flipped loses no matter which way it went.
  if (special === 'opportunist') return state.opportunistTeam === winning;
  return state.roles[playerId] === winning;
}

// The Folk Hero's sacrifice costs them their turns; their cards stay on the table.
export function isSidelined(playerId: string, state: GameState): boolean {
  return state.folkHeroSpent && state.specialRoles[playerId] === 'folk-hero';
}

export function folkHeroId(state: GameState): string | null {
  const entry = Object.entries(state.specialRoles).find(([, r]) => r === 'folk-hero');
  return entry ? entry[0] : null;
}
