import { describe, it, expect } from 'vitest';
import { assignLibraries } from './derangement';
import { emptyLibrary } from '../types';
import type { WordLibrary } from '../types';

function libFor(owner: string): WordLibrary {
  const lib = emptyLibrary();
  lib.noun.push(`${owner}-word`);
  return lib;
}

describe('assignLibraries', () => {
  it('n=1 assigns a synthetic fallback library, not the player\'s own', () => {
    const libraries = new Map([['p1', libFor('p1')]]);
    const assignments = assignLibraries(libraries);
    expect(assignments.p1.ownerPlayerId).toBe('fallback');
    expect(assignments.p1.library).not.toBe(libraries.get('p1'));
  });

  it('n=2 is a true swap', () => {
    const libraries = new Map([
      ['p1', libFor('p1')],
      ['p2', libFor('p2')],
    ]);
    const assignments = assignLibraries(libraries);
    expect(assignments.p1.ownerPlayerId).toBe('p2');
    expect(assignments.p2.ownerPlayerId).toBe('p1');
  });

  it('never assigns a player their own library, across many randomized runs and sizes', () => {
    for (let n = 2; n <= 8; n++) {
      for (let trial = 0; trial < 20; trial++) {
        const libraries = new Map<string, WordLibrary>();
        for (let i = 0; i < n; i++) libraries.set(`p${i}`, libFor(`p${i}`));
        const assignments = assignLibraries(libraries);
        for (const [playerId, assignment] of Object.entries(assignments)) {
          expect(assignment.ownerPlayerId).not.toBe(playerId);
        }
      }
    }
  });

  it('n=0 returns an empty assignment map', () => {
    expect(assignLibraries(new Map())).toEqual({});
  });
});
