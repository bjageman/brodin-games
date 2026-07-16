import { describe, it, expect } from 'vitest';
import { isFuzzyMatch } from './fuzzyMatch';

describe('isFuzzyMatch', () => {
  it('matches exact case-insensitive strings', () => {
    expect(isFuzzyMatch('Frog', 'frog')).toBe(true);
    expect(isFuzzyMatch('ice cream', 'Ice Cream')).toBe(true);
  });

  it('matches plural and singular variants', () => {
    expect(isFuzzyMatch('frogs', 'frog')).toBe(true);
    expect(isFuzzyMatch('frog', 'frogs')).toBe(true);
    expect(isFuzzyMatch('elephant', 'elephants')).toBe(true);
  });

  it('ignores spaces and hyphens', () => {
    expect(isFuzzyMatch('ice-cream', 'ice cream')).toBe(true);
    expect(isFuzzyMatch('newyorkcity', 'New York City')).toBe(true);
  });

  it('allows small typos within edit distance of 2', () => {
    expect(isFuzzyMatch('coffe cup', 'Coffee Cup')).toBe(true);
    expect(isFuzzyMatch('elphant', 'Elephant')).toBe(true);
  });

  it('rejects completely wrong guesses', () => {
    expect(isFuzzyMatch('dog', 'cat')).toBe(false);
    expect(isFuzzyMatch('new york', 'New York City')).toBe(false);
  });
});
