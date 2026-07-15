import { describe, it, expect } from 'vitest';
import { QUESTIONS } from './questions';

describe('QUESTIONS', () => {
  it('has a healthy starter bank', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(40);
  });

  it('never repeats an id', () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every question exactly four non-empty choices', () => {
    QUESTIONS.forEach((q) => {
      expect(q.choices).toHaveLength(4);
      q.choices.forEach((c) => expect(c.trim().length).toBeGreaterThan(0));
    });
  });

  it('never repeats a choice within one question', () => {
    QUESTIONS.forEach((q) => {
      expect(new Set(q.choices).size).toBe(4);
    });
  });

  it('points correctIndex at a real choice', () => {
    QUESTIONS.forEach((q) => {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThanOrEqual(3);
    });
  });

  it('has a non-empty question and category on every entry', () => {
    QUESTIONS.forEach((q) => {
      expect(q.question.trim().length).toBeGreaterThan(0);
      expect(q.category.trim().length).toBeGreaterThan(0);
    });
  });

  it('spreads questions across multiple categories', () => {
    const categories = new Set(QUESTIONS.map((q) => q.category));
    expect(categories.size).toBeGreaterThanOrEqual(5);
  });
});
