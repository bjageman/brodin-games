import { describe, it, expect } from 'vitest';
import { buildRoom, DUNGEON_LENGTH, isBossRoom, monsterHpFor, pickQuestion } from './dungeon';
import { QUESTIONS } from './questions';

describe('isBossRoom', () => {
  it('is only true for the last room', () => {
    for (let i = 0; i < DUNGEON_LENGTH - 1; i++) expect(isBossRoom(i)).toBe(false);
    expect(isBossRoom(DUNGEON_LENGTH - 1)).toBe(true);
  });
});

describe('monsterHpFor', () => {
  it('scales with player count', () => {
    expect(monsterHpFor(0, 4)).toBe(4);
    expect(monsterHpFor(0, 1)).toBe(1);
  });

  it('gives the boss more HP than a regular room at the same player count', () => {
    const regular = monsterHpFor(0, 4);
    const boss = monsterHpFor(DUNGEON_LENGTH - 1, 4);
    expect(boss).toBeGreaterThan(regular);
  });
});

describe('pickQuestion', () => {
  it('never repeats an already-asked question while unseen ones remain', () => {
    const asked: string[] = [];
    for (let i = 0; i < QUESTIONS.length; i++) {
      const q = pickQuestion(asked);
      expect(asked).not.toContain(q.id);
      asked.push(q.id);
    }
  });

  it('falls back to the full pool rather than throwing once everything is seen', () => {
    const allIds = QUESTIONS.map((q) => q.id);
    expect(() => pickQuestion(allIds)).not.toThrow();
    expect(QUESTIONS.map((q) => q.id)).toContain(pickQuestion(allIds).id);
  });
});

describe('buildRoom', () => {
  it('gives a fresh room full monster HP and a real question', () => {
    const room = buildRoom(0, 3, []);
    expect(room.monsterHp).toBe(room.monsterMaxHp);
    expect(room.monsterHp).toBeGreaterThan(0);
    expect(QUESTIONS.map((q) => q.id)).toContain(room.question.id);
  });

  it('flags the last room as the boss', () => {
    expect(buildRoom(DUNGEON_LENGTH - 1, 3, []).isBoss).toBe(true);
    expect(buildRoom(0, 3, []).isBoss).toBe(false);
  });
});
