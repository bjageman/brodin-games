import { QUESTIONS, type Question } from './questions';
import { BOSS_HP_MULTIPLIER, REGULAR_ROOM_COUNT } from './constants';
import type { ActiveRoom } from './types';

export const DUNGEON_LENGTH = REGULAR_ROOM_COUNT + 1; // + boss room

export function isBossRoom(roomIndex: number): boolean {
  return roomIndex === DUNGEON_LENGTH - 1;
}

export function monsterHpFor(roomIndex: number, playerCount: number): number {
  return playerCount * (isBossRoom(roomIndex) ? BOSS_HP_MULTIPLIER : 1);
}

// Picks a question nobody in this run has seen yet; if the bank ever runs dry
// (a very long run, or a tiny future bank), it just allows repeats rather
// than crash.
export function pickQuestion(askedIds: string[]): Question {
  const unseen = QUESTIONS.filter((q) => !askedIds.includes(q.id));
  const pool = unseen.length > 0 ? unseen : QUESTIONS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buildRoom(roomIndex: number, playerCount: number, askedIds: string[]): ActiveRoom {
  const monsterHp = monsterHpFor(roomIndex, playerCount);
  return {
    index: roomIndex,
    isBoss: isBossRoom(roomIndex),
    monsterHp,
    monsterMaxHp: monsterHp,
    question: pickQuestion(askedIds),
  };
}
