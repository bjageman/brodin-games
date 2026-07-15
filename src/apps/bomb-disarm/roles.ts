import { rebelCountFor } from './constants';
import { shuffle } from './deck';
import type { GameState, Role, SpecialRole, Winner } from './types';

export const SPECIAL_ROLES: SpecialRole[] = ['procrastinator', 'opportunist', 'folk-hero'];

// The Procrastinator wants the clock to run out, which lines up with the rebels
// far more than the peacekeepers, so they take a rebel's seat. Opportunist and
// Folk Hero still take a peacekeeper's seat.
const REBEL_SPECIAL_ROLES: SpecialRole[] = ['procrastinator'];
const PEACEKEEPER_SPECIAL_ROLES: SpecialRole[] = ['opportunist', 'folk-hero'];

export const SPECIAL_ROLE_META: Record<SpecialRole, { title: string; icon: string; blurb: string }> = {
  procrastinator: {
    title: 'Procrastinator',
    icon: '🐌',
    blurb: 'A rebel. You want the clock to run out. You win only if round 3 ends with no bomb revealed and fewer than 6 wires cut — a bomb going off or the last wire being cut is a loss for you.',
  },
  opportunist: {
    title: 'Opportunist',
    icon: '🎭',
    blurb: 'On your turn you may flip your card on the table and publicly pick a side. You must do it before the game ends, or you lose.',
  },
  'folk-hero': {
    title: 'Folk Hero',
    icon: '🦸',
    blurb: 'A peacekeeper. If a bomb is revealed you may reveal yourself to keep the game alive — but you take no more turns after that. An extra bomb is added to the deck to make up for your save.',
  },
};

// One plain rebel and one plain peacekeeper are always left over, so a table's
// only rebel (3-4 players) is never turned entirely into a Procrastinator, and
// the same holds for the peacekeepers.
export function maxSpecialRolesFor(playerCount: number): number {
  return maxRebelSpecialSeatsFor(playerCount) + maxPeacekeeperSpecialSeatsFor(playerCount);
}

function maxRebelSpecialSeatsFor(playerCount: number): number {
  // At 8-10 players the real rebel count is a hidden 2-or-3 draw; assuming the
  // smaller number keeps this safe regardless of which way it lands.
  const minRebels = playerCount <= 4 ? 1 : 2;
  return Math.max(0, Math.min(REBEL_SPECIAL_ROLES.length, minRebels - 1));
}

function maxPeacekeeperSpecialSeatsFor(playerCount: number): number {
  const rebels = playerCount <= 4 ? 1 : playerCount <= 7 ? 2 : 3;
  return Math.max(0, Math.min(PEACEKEEPER_SPECIAL_ROLES.length, playerCount - rebels - 1));
}

export function assignRoles(playerIds: string[], enabled: SpecialRole[]): {
  roles: Record<string, Role>;
  specialRoles: Record<string, SpecialRole>;
} {
  const order = shuffle(playerIds);
  const rebelCount = rebelCountFor(playerIds.length);
  const rebelSeats = order.slice(0, rebelCount);
  const peacekeeperSeats = order.slice(rebelCount);

  const roles: Record<string, Role> = {};
  const rebelSet = new Set(rebelSeats);
  playerIds.forEach((id) => { roles[id] = rebelSet.has(id) ? 'rebel' : 'peacekeeper'; });

  const specialRoles: Record<string, SpecialRole> = {};

  const rebelSpecials = enabled.filter((r) => REBEL_SPECIAL_ROLES.includes(r));
  rebelSpecials.slice(0, maxRebelSpecialSeatsFor(playerIds.length)).forEach((role, i) => {
    if (rebelSeats[i]) specialRoles[rebelSeats[i]] = role;
  });

  const peacekeeperSpecials = enabled.filter((r) => PEACEKEEPER_SPECIAL_ROLES.includes(r));
  peacekeeperSpecials.slice(0, maxPeacekeeperSpecialSeatsFor(playerIds.length)).forEach((role, i) => {
    if (peacekeeperSeats[i]) specialRoles[peacekeeperSeats[i]] = role;
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
