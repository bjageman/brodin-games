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
  it('every blank has a non-empty option list even when the assigned library has zero words in that category', () => {
    const library = emptyLibrary();
    const options = buildDropdownOptions(library, template);
    expect(options.noun_1.length).toBeGreaterThan(0);
    expect(options.pronoun_1.length).toBeGreaterThan(0);
  });

  it('includes the assigned library words alongside fallback words, deduped', () => {
    const library = emptyLibrary();
    library.noun.push('robot', 'robot');
    const options = buildDropdownOptions(library, template);
    const roboCount = options.noun_1.filter((w) => w === 'robot').length;
    expect(roboCount).toBe(1);
  });
});
