import { describe, it, expect } from 'vitest';
import { buildDropdownOptions } from './fallbackMerge';
import { emptyLibrary } from '../types';
import type { MadLibTemplate } from '../types';

const template: MadLibTemplate = {
  id: 't1',
  title: 'Test',
  text: '{{noun_1}} {{pronoun_1}}',
  blanks: [
    { id: 'noun_1', category: 'noun' },
    { id: 'pronoun_1', category: 'pronoun' },
  ],
};

describe('buildDropdownOptions', () => {
  it('every non-pronoun blank has a non-empty option list even when the assigned library has zero words in that category', () => {
    const library = emptyLibrary();
    const options = buildDropdownOptions(library, template);
    expect(options.noun_1.length).toBeGreaterThan(0);
  });

  it('tops up with fallback words (deduped) when a category has fewer than 5 real words', () => {
    const library = emptyLibrary();
    library.noun.push('robot', 'robot');
    const options = buildDropdownOptions(library, template);
    const roboCount = options.noun_1.filter((w) => w === 'robot').length;
    expect(roboCount).toBe(1);
    expect(options.noun_1).toContain('robot');
    expect(options.noun_1.length).toBeGreaterThanOrEqual(5);
  });

  it('guarantees at least 5 options per collected category, padding short ones with filler', () => {
    const library = emptyLibrary();
    library.noun.push('robot', 'wizard', 'sandwich');
    const options = buildDropdownOptions(library, template);
    expect(options.noun_1.length).toBeGreaterThanOrEqual(5);
    // real contributed words are always kept
    expect(options.noun_1).toEqual(expect.arrayContaining(['robot', 'wizard', 'sandwich']));
  });

  it('uses only the real contributed words once a category has 5 or more, with no fallback filler', () => {
    const library = emptyLibrary();
    library.noun.push('robot', 'wizard', 'sandwich', 'castle', 'dragon');
    const options = buildDropdownOptions(library, template);
    expect(options.noun_1).toEqual(['robot', 'wizard', 'sandwich', 'castle', 'dragon']);
  });

  it('pronoun blanks are always the roster, never anything collected from players or the generic "he/she/they" word bank', () => {
    const library = emptyLibrary();
    library.pronoun.push('whatever-got-collected');
    const options = buildDropdownOptions(library, template, ['Gimli', 'Frodo', 'Gandalf']);
    expect(options.pronoun_1).toEqual(['Gimli', 'Frodo', 'Gandalf']);
    expect(options.pronoun_1).not.toContain('he');
    expect(options.pronoun_1).not.toContain('she');
  });

  it('pronoun blanks are empty when no roster is given', () => {
    const library = emptyLibrary();
    const options = buildDropdownOptions(library, template);
    expect(options.pronoun_1).toEqual([]);
  });
});
