import fallbackWords from '../data/fallbackWords.json';
import { CATEGORIES, emptyLibrary } from '../types';
import type { WordLibrary, WordSourceAssignment } from '../types';

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const FALLBACK_LIBRARY = fallbackWords as WordLibrary;

function mergeLibraries(a: WordLibrary, b: WordLibrary): WordLibrary {
  const merged = emptyLibrary();
  for (const category of CATEGORIES) {
    merged[category] = Array.from(new Set([...a[category], ...b[category]]));
  }
  return merged;
}

/**
 * Assigns each player a word library combined from two OTHER players (never
 * their own), so filling in a mad-lib always uses words nobody wrote for
 * themselves. Cyclic rotation of a random shuffle (each player draws from
 * the next two players in the shuffled order) is a valid two-contributor
 * derangement for any n >= 3. The degenerate cases have no second (or any)
 * other player to draw from: n=2 falls back to the one other player alone,
 * and n=1 (solo host, nobody else joined) gets a synthetic library built
 * from the same fallback word bank used for round-2 dropdown top-up.
 */
export function assignLibraries(
  playerLibraries: Map<string, WordLibrary>,
  playerNames: Map<string, string>
): Record<string, WordSourceAssignment> {
  const ids = shuffle(Array.from(playerLibraries.keys()));
  const n = ids.length;
  const assignments: Record<string, WordSourceAssignment> = {};

  if (n === 0) return assignments;

  if (n === 1) {
    assignments[ids[0]] = { library: FALLBACK_LIBRARY, contributorPlayerIds: [], contributorNames: [] };
    return assignments;
  }

  if (n === 2) {
    for (let i = 0; i < 2; i++) {
      const otherId = ids[(i + 1) % 2];
      assignments[ids[i]] = {
        library: playerLibraries.get(otherId)!,
        contributorPlayerIds: [otherId],
        contributorNames: [playerNames.get(otherId) ?? 'Unknown'],
      };
    }
    return assignments;
  }

  for (let i = 0; i < n; i++) {
    const firstId = ids[(i + 1) % n];
    const secondId = ids[(i + 2) % n];
    assignments[ids[i]] = {
      library: mergeLibraries(playerLibraries.get(firstId)!, playerLibraries.get(secondId)!),
      contributorPlayerIds: [firstId, secondId],
      contributorNames: [playerNames.get(firstId) ?? 'Unknown', playerNames.get(secondId) ?? 'Unknown'],
    };
  }

  return assignments;
}
