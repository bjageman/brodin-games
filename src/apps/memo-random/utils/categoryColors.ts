import type { Category } from '../types';

export interface CategoryStyle {
  label: string;
  border: string;
  text: string;
  /** Darker shade of the same hue, for use on light (e.g. paper/email) backgrounds. */
  textOnLight: string;
  bg: string;
}

export const CATEGORY_STYLES: Record<Category, CategoryStyle> = {
  noun: { label: 'Noun', border: 'border-blue-400', text: 'text-blue-300', textOnLight: 'text-blue-700', bg: 'bg-blue-500/10' },
  verb: { label: 'Verb', border: 'border-red-400', text: 'text-red-300', textOnLight: 'text-red-700', bg: 'bg-red-500/10' },
  adjective: { label: 'Adjective', border: 'border-emerald-400', text: 'text-emerald-300', textOnLight: 'text-emerald-700', bg: 'bg-emerald-500/10' },
  pronoun: { label: 'Pronoun', border: 'border-amber-400', text: 'text-amber-300', textOnLight: 'text-amber-700', bg: 'bg-amber-500/10' },
};
