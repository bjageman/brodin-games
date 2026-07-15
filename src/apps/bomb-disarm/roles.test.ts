import { describe, it, expect } from 'vitest';
import { SPECIAL_ROLES, assignRoles, didWin, isSidelined, maxSpecialRolesFor, winningRole } from './roles';
import type { EndReason, GameState, Role, SpecialRole, Winner } from './types';

function stateWith(fields: Partial<GameState>): GameState {
  return {
    phase: 'results', round: 3, revealsThisRound: 0, pendingWinner: null, pendingEffect: null,
    peek: null, rogueAgentId: null, deckAdditions: [], effectNote: null,
    roles: {}, specialRoles: {}, revealedRoleIds: [], folkHeroSpent: false, opportunistTeam: null,
    pendingRescue: null, endReason: null, hands: {}, activePlayerId: '', wiresRevealed: 0, turn: 0,
    roleRevealEndTimestamp: null, memorizeEndTimestamp: null, winner: null, lastReveal: null,
    ...fields,
  };
}

const outcome = (
  role: Role,
  winner: Winner,
  endReason: EndReason,
  special?: SpecialRole,
  opportunistTeam: Role | null = null,
) =>
  didWin('p', stateWith({
    roles: { p: role },
    specialRoles: special ? { p: special } : {},
    winner,
    endReason,
    opportunistTeam,
  }));

describe('winningRole', () => {
  // The bug this guards: `winner` is plural ('rebels'), a role is singular
  // ('rebel'), so comparing them directly silently makes everyone a loser.
  it('maps a winning side onto the role that shares it', () => {
    expect(winningRole('rebels')).toBe('rebel');
    expect(winningRole('peacekeepers')).toBe('peacekeeper');
  });
});

describe('didWin — ordinary players', () => {
  it('wins with their own side', () => {
    expect(outcome('rebel', 'rebels', 'bomb')).toBe(true);
    expect(outcome('peacekeeper', 'peacekeepers', 'wires')).toBe(true);
  });

  it('loses with the other side', () => {
    expect(outcome('rebel', 'peacekeepers', 'wires')).toBe(false);
    expect(outcome('peacekeeper', 'rebels', 'bomb')).toBe(false);
  });

  it('nobody wins before the game is over', () => {
    expect(didWin('p', stateWith({ roles: { p: 'rebel' }, winner: null }))).toBe(false);
  });
});

describe('didWin — Procrastinator', () => {
  it('wins only when the clock runs out', () => {
    expect(outcome('peacekeeper', 'rebels', 'timeout', 'procrastinator')).toBe(true);
  });

  it('loses when a bomb goes off, even though the rebels take that too', () => {
    expect(outcome('peacekeeper', 'rebels', 'bomb', 'procrastinator')).toBe(false);
  });

  it('loses when the wires are cut', () => {
    expect(outcome('peacekeeper', 'peacekeepers', 'wires', 'procrastinator')).toBe(false);
  });

  it('is credited alongside the rebels on a timeout', () => {
    const state = stateWith({
      roles: { hero: 'rebel', slow: 'peacekeeper' },
      specialRoles: { slow: 'procrastinator' },
      winner: 'rebels',
      endReason: 'timeout',
    });
    expect(didWin('hero', state)).toBe(true);
    expect(didWin('slow', state)).toBe(true);
  });
});

describe('didWin — Opportunist', () => {
  it('wins if they flipped to the winning side', () => {
    expect(outcome('rebel', 'rebels', 'bomb', 'opportunist', 'rebel')).toBe(true);
    expect(outcome('peacekeeper', 'peacekeepers', 'wires', 'opportunist', 'peacekeeper')).toBe(true);
  });

  it('loses if they flipped to the losing side', () => {
    expect(outcome('rebel', 'peacekeepers', 'wires', 'opportunist', 'rebel')).toBe(false);
  });

  // "You must do this before the game ends or you lose."
  it('loses if they never flipped, even sitting on the winning side', () => {
    expect(outcome('peacekeeper', 'peacekeepers', 'wires', 'opportunist', null)).toBe(false);
    expect(outcome('rebel', 'rebels', 'bomb', 'opportunist', null)).toBe(false);
  });
});

describe('didWin — Folk Hero', () => {
  it('rides the peacekeepers like any other peacekeeper', () => {
    expect(outcome('peacekeeper', 'peacekeepers', 'wires', 'folk-hero')).toBe(true);
    expect(outcome('peacekeeper', 'rebels', 'bomb', 'folk-hero')).toBe(false);
  });
});

describe('isSidelined', () => {
  it('only sidelines the Folk Hero, and only once they have spent themselves', () => {
    const spent = stateWith({ specialRoles: { p: 'folk-hero' }, folkHeroSpent: true });
    const unspent = stateWith({ specialRoles: { p: 'folk-hero' }, folkHeroSpent: false });
    expect(isSidelined('p', spent)).toBe(true);
    expect(isSidelined('p', unspent)).toBe(false);
    expect(isSidelined('other', spent)).toBe(false);
  });
});

describe('maxSpecialRolesFor', () => {
  it('always leaves a plain peacekeeper behind', () => {
    for (let n = 3; n <= 10; n++) {
      const rebels = n <= 4 ? 1 : n <= 7 ? 2 : 3;
      expect(maxSpecialRolesFor(n)).toBeLessThanOrEqual(n - rebels - 1);
    }
  });

  it('never offers more than the three roles that exist', () => {
    for (let n = 3; n <= 10; n++) {
      expect(maxSpecialRolesFor(n)).toBeLessThanOrEqual(SPECIAL_ROLES.length);
    }
  });
});

describe('assignRoles', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('gives everyone a team', () => {
    const { roles } = assignRoles(ids, []);
    ids.forEach((id) => expect(['rebel', 'peacekeeper']).toContain(roles[id]));
  });

  // Special roles take peacekeeper seats, so the rebel count — and the win
  // balance tuned around it — is identical whether they are on or off.
  it('never hands a special role to a rebel', () => {
    for (let i = 0; i < 100; i++) {
      const { roles, specialRoles } = assignRoles(ids, [...SPECIAL_ROLES]);
      Object.keys(specialRoles).forEach((id) => expect(roles[id]).toBe('peacekeeper'));
    }
  });

  it('keeps the rebel count the same with and without special roles', () => {
    const count = (r: Record<string, Role>) => Object.values(r).filter((x) => x === 'rebel').length;
    for (let i = 0; i < 50; i++) {
      expect(count(assignRoles(ids, [...SPECIAL_ROLES]).roles)).toBe(count(assignRoles(ids, []).roles));
    }
  });

  it('hands out each chosen role exactly once', () => {
    const { specialRoles } = assignRoles(ids, [...SPECIAL_ROLES]);
    const handed = Object.values(specialRoles);
    expect(handed.sort()).toEqual([...SPECIAL_ROLES].sort());
    expect(new Set(Object.keys(specialRoles)).size).toBe(handed.length);
  });

  it('leaves a plain peacekeeper even with every role switched on', () => {
    for (let n = 3; n <= 10; n++) {
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      const { roles, specialRoles } = assignRoles(players, [...SPECIAL_ROLES]);
      const plain = players.filter((p) => roles[p] === 'peacekeeper' && !specialRoles[p]);
      expect(plain.length).toBeGreaterThanOrEqual(1);
    }
  });
});
