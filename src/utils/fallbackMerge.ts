import fallbackWordsData from '../data/fallbackWords.json';
import type { Category, MadLibTemplate, WordLibrary } from '../types';

const FALLBACK_WORDS = fallbackWordsData as Record<Category, string[]>;

function dedupe(words: string[]): string[] {
  return Array.from(new Set(words));
}

/**
 * Builds the dropdown option list for every blank in a template. Every
 * blank's category is always topped up with the static fallback word bank
 * (even when the assigned library has words) so a category with zero or too
 * few assigned words never leaves a blank with an empty/unusable dropdown.
 */
export function buildDropdownOptions(
  assignedLibrary: WordLibrary,
  template: MadLibTemplate
): Record<string, string[]> {
  const optionsByCategory: Partial<Record<Category, string[]>> = {};
  const options: Record<string, string[]> = {};

  for (const blank of template.blanks) {
    if (!optionsByCategory[blank.category]) {
      optionsByCategory[blank.category] = dedupe([
        ...assignedLibrary[blank.category],
        ...FALLBACK_WORDS[blank.category],
      ]);
    }
    options[blank.id] = optionsByCategory[blank.category]!;
  }

  return options;
}
