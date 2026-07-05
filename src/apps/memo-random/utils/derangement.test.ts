import { describe, it, expect } from 'vitest';
import { assignLibraries } from './derangement';
import { emptyLibrary } from '../types';
import type { WordLibrary } from '../types';

function libFor(owner: string): WordLibrary {
  const lib = emptyLibrary();
  lib.noun.push(`${owner}-word`);
  return lib;
}

function namesFor(ids: string[]): Map<string, string> {
  return new Map(ids.map((id) => [id, `Name-${id}`]));
}

describe('assignLibraries', () => {
  it('n=1 assigns a synthetic fallback library, not the player\'s own, with no contributors', () => {
    const libraries = new Map([['p1', libFor('p1')]]);
    const assignments = assignLibraries(libraries, namesFor(['p1']));
    expect(assignments.p1.contributorPlayerIds).toEqual([]);
    expect(assignments.p1.library).not.toBe(libraries.get('p1'));
  });

  it('n=2 draws from the one other player', () => {
    const libraries = new Map([
      ['p1', libFor('p1')],
      ['p2', libFor('p2')],
    ]);
    const assignments = assignLibraries(libraries, namesFor(['p1', 'p2']));
    expect(assignments.p1.contributorPlayerIds).toEqual(['p2']);
    expect(assignments.p2.contributorPlayerIds).toEqual(['p1']);
  });

  it('n>=3 combines words from exactly two other players', () => {
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4'];
    const libraries = new Map(ids.map((id) => [id, libFor(id)]));
    const assignments = assignLibraries(libraries, namesFor(ids));
    for (const id of ids) {
      const assignment = assignments[id];
      expect(assignment.contributorPlayerIds).toHaveLength(2);
      expect(new Set(assignment.contributorPlayerIds).size).toBe(2);
      expect(assignment.library.noun).toContain(`${assignment.contributorPlayerIds[0]}-word`);
      expect(assignment.library.noun).toContain(`${assignment.contributorPlayerIds[1]}-word`);
    }
  });

  it('never assigns a player their own words, across many randomized runs and sizes', () => {
    for (let n = 2; n <= 8; n++) {
      for (let trial = 0; trial < 20; trial++) {
        const ids = Array.from({ length: n }, (_, i) => `p${i}`);
        const libraries = new Map(ids.map((id) => [id, libFor(id)]));
        const assignments = assignLibraries(libraries, namesFor(ids));
        for (const [playerId, assignment] of Object.entries(assignments)) {
          expect(assignment.contributorPlayerIds).not.toContain(playerId);
          expect(assignment.library.noun).not.toContain(`${playerId}-word`);
        }
      }
    }
  });

  it('contributorNames resolves from the provided player-name map', () => {
    const libraries = new Map([
      ['p1', libFor('p1')],
      ['p2', libFor('p2')],
    ]);
    const assignments = assignLibraries(libraries, new Map([['p1', 'Alice'], ['p2', 'Bob']]));
    expect(assignments.p1.contributorNames).toEqual(['Bob']);
    expect(assignments.p2.contributorNames).toEqual(['Alice']);
  });

  it('n=0 returns an empty assignment map', () => {
    expect(assignLibraries(new Map(), new Map())).toEqual({});
  });
});
