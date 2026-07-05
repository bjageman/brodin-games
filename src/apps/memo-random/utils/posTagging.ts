import nlp from 'compromise';
import type { Category } from '../types';

// compromise's general-purpose lexicon either doesn't recognize some real,
// common words at all (e.g. "holy" tags as nothing, getting rejected as a
// typo would be) or slots them into a technically-valid-but-surprising
// category (e.g. "queer" tags as a noun). These overrides — mostly slang
// and cheekier words players actually want to use — are checked before
// asking compromise, so they land in the category most people would expect.
const CATEGORY_OVERRIDES: Record<string, Category> = {
  holy: 'adjective',
  gay: 'adjective',
  gayer: 'adjective',
  queer: 'adjective',
  thicc: 'adjective',
  saucy: 'adjective',
  sultry: 'adjective',
  twerk: 'verb',
  smooch: 'verb',
  strut: 'verb',
  swagger: 'verb',
  sashay: 'verb',
};

/**
 * compromise tags pronouns as BOTH Noun and Pronoun simultaneously, so
 * Pronoun must be checked before Noun or every pronoun would be
 * misclassified as a noun. Words that don't fit any of the four
 * categories (determiners, conjunctions, adverbs, etc.) are dropped.
 */
export function tagWord(word: string): Category | null {
  const override = CATEGORY_OVERRIDES[word.trim().toLowerCase()];
  if (override) return override;

  const doc = nlp(word);
  if (doc.match('#Pronoun').found) return 'pronoun';
  if (doc.verbs().found) return 'verb';
  if (doc.adjectives().found) return 'adjective';
  if (doc.nouns().found) return 'noun';
  return null;
}
