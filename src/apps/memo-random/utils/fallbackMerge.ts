import fallbackWordsData from '../data/fallbackWords.json';
import type { Category, MadLibTemplate, WordLibrary } from '../types';

const FALLBACK_WORDS = fallbackWordsData as Record<Category, string[]>;

// Every collected category a player fills in round 2 should offer a decent set
// of choices, even if the other players didn't contribute many real words for
// it. If a category comes up short, we top it up to this many options with
// random filler words.
const MIN_OPTIONS = 5;

function dedupe(words: string[]): string[] {
  return Array.from(new Set(words));
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Builds the dropdown option list for every blank in a template. A category is
 * topped up with random filler only when the players who contributed to this
 * library came up with fewer than MIN_OPTIONS real words for it — so every
 * category always offers at least MIN_OPTIONS choices, while a category that
 * already has plenty stays real-words-only (filler never dilutes it). Pronouns
 * are never collected from players at all — that dropdown is always just the
 * roster of players actually in the game, never the static "he/she/they" bank.
 */
export function buildDropdownOptions(
  assignedLibrary: WordLibrary,
  template: MadLibTemplate,
  rosterNames: string[] = []
): Record<string, string[]> {
  const optionsByCategory: Partial<Record<Category, string[]>> = {};
  const options: Record<string, string[]> = {};

  for (const blank of template.blanks) {
    if (!optionsByCategory[blank.category]) {
      if (blank.category === 'pronoun') {
        optionsByCategory.pronoun = dedupe(rosterNames);
      } else {
        const real = dedupe(assignedLibrary[blank.category]);
        if (real.length >= MIN_OPTIONS) {
          optionsByCategory[blank.category] = real;
        } else {
          // Pad with random fallback words the players didn't already supply,
          // enough to reach MIN_OPTIONS (or exhaust the fallback bank).
          const existing = new Set(real);
          const filler = shuffle(FALLBACK_WORDS[blank.category].filter((w) => !existing.has(w)));
          optionsByCategory[blank.category] = [...real, ...filler.slice(0, Math.max(0, MIN_OPTIONS - real.length))];
        }
      }
    }
    options[blank.id] = optionsByCategory[blank.category]!;
  }

  return options;
}
