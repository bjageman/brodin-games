function getLevenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[a.length][b.length];
}

export function normalizeWord(word: string): string {
  let normalized = word.toLowerCase().trim();
  // Remove all non-alphanumeric characters (spaces, hyphens, punctuation)
  normalized = normalized.replace(/[^a-z0-9]/g, '');
  // Simple plural removal: if it ends in 's' but not 'ss', remove the 's'
  if (normalized.endsWith('s') && !normalized.endsWith('ss') && normalized.length > 3) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function isFuzzyMatch(guess: string, target: string): boolean {
  const normGuess = normalizeWord(guess);
  const normTarget = normalizeWord(target);

  if (normGuess === normTarget) return true;

  const distance = getLevenshteinDistance(normGuess, normTarget);
  return distance <= 2;
}
