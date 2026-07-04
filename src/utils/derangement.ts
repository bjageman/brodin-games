import fallbackWords from '../data/fallbackWords.json';
import type { PlayerAssignment, WordLibrary } from '../types';

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const FALLBACK_LIBRARY = fallbackWords as WordLibrary;

/**
 * Assigns each player another player's word library so no one ever gets
 * their own words back. Cyclic rotation of a random shuffle is a valid
 * derangement for any n >= 2 (an n=2 rotation is just a swap). The n=1
 * degenerate case (solo host, nobody else joined) has no other library to
 * assign, so it gets a synthetic library built from the same fallback word
 * bank used for round-2 dropdown top-up.
 */
export function assignLibraries(
  playerLibraries: Map<string, WordLibrary>
): Record<string, PlayerAssignment> {
  const ids = shuffle(Array.from(playerLibraries.keys()));
  const n = ids.length;
  const assignments: Record<string, PlayerAssignment> = {};

  if (n === 0) return assignments;

  if (n === 1) {
    assignments[ids[0]] = { library: FALLBACK_LIBRARY, ownerPlayerId: 'fallback' };
    return assignments;
  }

  for (let i = 0; i < n; i++) {
    const nextIndex = (i + 1) % n;
    const nextId = ids[nextIndex];
    assignments[ids[i]] = {
      library: playerLibraries.get(nextId)!,
      ownerPlayerId: nextId,
    };
  }

  return assignments;
}
