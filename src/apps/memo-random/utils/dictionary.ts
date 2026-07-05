let dictionarySet: Set<string> | null = null;
let loadingPromise: Promise<Set<string>> | null = null;

/**
 * Lazily loads the ~275k-word English dictionary as a dynamic import so it
 * doesn't bloat the initial bundle. Call this as soon as a player reaches the
 * lobby screen (idle time before round 1 starts) rather than waiting until
 * they start typing.
 */
export function loadDictionary(): Promise<Set<string>> {
  if (dictionarySet) return Promise.resolve(dictionarySet);
  if (loadingPromise) return loadingPromise;

  loadingPromise = import('an-array-of-english-words').then((mod) => {
    const words = (mod.default ?? mod) as unknown as string[];
    dictionarySet = new Set(words.map((w) => w.toLowerCase()));
    return dictionarySet;
  });
  return loadingPromise;
}

export function getDictionary(): Set<string> | null {
  return dictionarySet;
}

export function isValidWord(word: string): boolean {
  if (!dictionarySet) return true; // optimistic accept while still loading
  return dictionarySet.has(word.trim().toLowerCase());
}
