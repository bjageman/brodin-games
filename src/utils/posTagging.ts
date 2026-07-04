import nlp from 'compromise';
import { emptyLibrary, type Category, type WordLibrary } from '../types';

/**
 * compromise tags pronouns as BOTH Noun and Pronoun simultaneously, so
 * Pronoun must be checked before Noun or every pronoun would be
 * misclassified as a noun. Words that don't fit any of the four
 * categories (determiners, conjunctions, adverbs, etc.) are dropped.
 */
export function tagWord(word: string): Category | null {
  const doc = nlp(word);
  if (doc.match('#Pronoun').found) return 'pronoun';
  if (doc.verbs().found) return 'verb';
  if (doc.adjectives().found) return 'adjective';
  if (doc.nouns().found) return 'noun';
  return null;
}

export function buildWordLibrary(words: string[]): WordLibrary {
  const library = emptyLibrary();
  for (const word of words) {
    const category = tagWord(word);
    if (category) library[category].push(word);
  }
  return library;
}
