import { describe, it, expect } from 'vitest';
import { pickTopic, formatMoney, TOPICS } from './constants';

describe('pickTopic', () => {
  it('never repeats a topic while unused ones remain', () => {
    let used: string[] = [];
    const seen: string[] = [];

    // Draw the whole pool. Not one should repeat.
    for (let i = 0; i < TOPICS.length; i++) {
      const result = pickTopic(used);
      seen.push(result.topic.name);
      used = result.usedNames;
    }

    expect(new Set(seen).size).toBe(TOPICS.length);
    expect(used).toHaveLength(TOPICS.length);
  });

  it('reshuffles once every topic has been played', () => {
    const allUsed = TOPICS.map((t) => t.name);

    const { topic, usedNames } = pickTopic(allUsed);

    expect(TOPICS.map((t) => t.name)).toContain(topic.name);
    // A fresh cycle starts from the newly drawn topic rather than staying full,
    // otherwise the pool would be permanently exhausted.
    expect(usedNames).toEqual([topic.name]);
  });

  it('excludes the previous topic — the bug that let "Cat" come up twice', () => {
    const previous = TOPICS[0].name;

    // Repeat enough times that a uniform-random pick would almost certainly
    // have collided (1/56 per draw).
    for (let i = 0; i < 300; i++) {
      expect(pickTopic([previous]).topic.name).not.toBe(previous);
    }
  });

  it('does not mutate the list it is given', () => {
    const used = ['Frog'];
    pickTopic(used);
    expect(used).toEqual(['Frog']);
  });
});

describe('formatMoney', () => {
  it('renders payouts as dollars with thousands separators', () => {
    expect(formatMoney(500)).toBe('$500');
    expect(formatMoney(1500)).toBe('$1,500');
    expect(formatMoney(20500)).toBe('$20,500');
    expect(formatMoney(0)).toBe('$0');
  });
});
