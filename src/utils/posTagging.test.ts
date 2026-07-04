import { describe, it, expect } from 'vitest';
import { tagWord, buildWordLibrary } from './posTagging';

describe('tagWord', () => {
  it('tags pronouns as pronoun, not noun (compromise tags both simultaneously)', () => {
    expect(tagWord('she')).toBe('pronoun');
    expect(tagWord('it')).toBe('pronoun');
    expect(tagWord('you')).toBe('pronoun');
  });

  it('tags common verbs, adjectives, and nouns', () => {
    expect(tagWord('run')).toBe('verb');
    expect(tagWord('happy')).toBe('adjective');
    expect(tagWord('dog')).toBe('noun');
  });

  it('drops determiners and conjunctions', () => {
    expect(tagWord('the')).toBeNull();
    expect(tagWord('and')).toBeNull();
  });
});

describe('buildWordLibrary', () => {
  it('sorts words into the correct categories and drops untaggable ones', () => {
    const library = buildWordLibrary(['dog', 'run', 'happy', 'she', 'the']);
    expect(library.noun).toContain('dog');
    expect(library.verb).toContain('run');
    expect(library.adjective).toContain('happy');
    expect(library.pronoun).toContain('she');
    const allWords = [...library.noun, ...library.verb, ...library.adjective, ...library.pronoun];
    expect(allWords).not.toContain('the');
  });
});
