import { describe, it, expect } from 'vitest';
import { tagWord } from './posTagging';

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
