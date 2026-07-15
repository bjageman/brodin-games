import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDungeon } from './useDungeon';
import { REVEAL_DURATION_MS, STARTING_HP } from './constants';
import { DUNGEON_LENGTH } from './dungeon';
import type { GameState } from './types';
import type { PlayerInfo } from '../../shared/types';

const EMPTY: GameState = {
  phase: 'starting',
  dungeonLength: 0,
  room: null,
  players: {},
  answers: {},
  roundEndTimestamp: null,
  lastReveal: null,
  askedQuestionIds: [],
  winnerIds: [],
};

const roster: PlayerInfo[] = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];

// The hook reads `state` from its own closure, so a real component would only
// see fresh values across a re-render. This harness mimics that: every
// `publish` call updates the tracked state and re-renders the hook with it.
function makeHarness(players = roster) {
  let state: GameState = EMPTY;
  const publish = (next: GameState) => { state = next; };
  const { result, rerender } = renderHook(({ s }) => useDungeon({ roster: players, state: s, publish }), {
    initialProps: { s: state },
  });
  const sync = () => rerender({ s: state });
  return {
    getState: () => state,
    startDungeon: () => { result.current.startDungeon(); sync(); },
    submitAnswer: (id: string, i: number) => { result.current.submitAnswer(id, i); sync(); },
    timeoutRound: () => { result.current.timeoutRound(); sync(); },
    // resolveRound's setTimeout fires a raw `publish` outside React, so the
    // hook's own closures go stale until the next render — re-sync after.
    tick: (ms: number) => { vi.advanceTimersByTime(ms); sync(); },
  };
}

describe('useDungeon', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('deals room 0 with everyone at full HP', () => {
    const h = makeHarness();
    h.startDungeon();
    const state = h.getState();
    expect(state.phase).toBe('question');
    expect(state.room?.index).toBe(0);
    expect(state.players.a.hp).toBe(STARTING_HP);
    expect(state.players.b.hp).toBe(STARTING_HP);
  });

  it('resolves the round once everyone has answered', () => {
    const h = makeHarness();
    h.startDungeon();
    const correct = h.getState().room!.question.correctIndex;
    h.submitAnswer('a', correct);
    expect(h.getState().phase).toBe('question'); // still waiting on Bob
    h.submitAnswer('b', correct);
    expect(h.getState().phase).toBe('reveal');
  });

  it('damages the monster for a correct answer and the player for a wrong one', () => {
    const h = makeHarness();
    h.startDungeon();
    const correct = h.getState().room!.question.correctIndex;
    const wrong = (correct + 1) % 4;
    const startingMonsterHp = h.getState().room!.monsterHp;

    h.submitAnswer('a', correct);
    h.submitAnswer('b', wrong);

    const state = h.getState();
    expect(state.room!.monsterHp).toBe(startingMonsterHp - 1);
    expect(state.players.a.score).toBe(1);
    expect(state.players.b.hp).toBe(STARTING_HP - 1);
    expect(state.lastReveal?.monsterDamage).toBe(1);
  });

  it('never lets HP go negative', () => {
    const h = makeHarness([{ id: 'a', name: 'Alice' }]);
    h.startDungeon();
    for (let i = 0; i < STARTING_HP + 2; i++) {
      const wrong = (h.getState().room!.question.correctIndex + 1) % 4;
      h.submitAnswer('a', wrong);
      h.tick(REVEAL_DURATION_MS);
    }
    expect(h.getState().players.a.hp).toBe(0);
  });

  it('rolls a new question in the same room if the monster survives', () => {
    // 2 players, monster starts at 2 HP — one correct answer isn't enough.
    const h = makeHarness();
    h.startDungeon();
    const roomIndex = h.getState().room!.index;
    const correct = h.getState().room!.question.correctIndex;
    const wrong = (correct + 1) % 4;

    h.submitAnswer('a', correct);
    h.submitAnswer('b', wrong);
    expect(h.getState().room!.monsterHp).toBeGreaterThan(0);

    h.tick(REVEAL_DURATION_MS);
    const state = h.getState();
    expect(state.phase).toBe('question');
    expect(state.room!.index).toBe(roomIndex); // same room
  });

  it('advances to the next room once the monster is defeated', () => {
    const h = makeHarness();
    h.startDungeon();
    const correct = h.getState().room!.question.correctIndex;
    h.submitAnswer('a', correct);
    h.submitAnswer('b', correct); // 2 players -> 2 damage -> room 0's 2-HP monster dies

    h.tick(REVEAL_DURATION_MS);
    const state = h.getState();
    expect(state.phase).toBe('question');
    expect(state.room!.index).toBe(1);
  });

  it('ends the game and crowns the highest scorer once the boss falls', () => {
    const h = makeHarness();
    h.startDungeon();

    // Alice always answers correctly, Bob never does, across every room.
    for (let round = 0; round < DUNGEON_LENGTH; round++) {
      let guard = 0;
      while (h.getState().phase === 'question' && guard < 20) {
        const correct = h.getState().room!.question.correctIndex;
        const wrong = (correct + 1) % 4;
        h.submitAnswer('a', correct);
        h.submitAnswer('b', wrong);
        h.tick(REVEAL_DURATION_MS);
        guard++;
      }
    }

    const state = h.getState();
    expect(state.phase).toBe('game-over');
    expect(state.winnerIds).toEqual(['a']);
    expect(state.players.a.score).toBeGreaterThan(state.players.b.score);
  });

  it('resolves with whatever was submitted once the timer runs out', () => {
    const h = makeHarness();
    h.startDungeon();
    h.submitAnswer('a', h.getState().room!.question.correctIndex);
    h.timeoutRound(); // Bob never answered
    const state = h.getState();
    expect(state.phase).toBe('reveal');
    expect(state.lastReveal?.answers.b).toBeUndefined();
    expect(state.players.b.hp).toBe(STARTING_HP - 1);
  });
});
