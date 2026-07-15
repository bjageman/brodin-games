import { describe, it, expect, vi } from 'vitest';
import { useQuizQuestDebug } from './useQuizQuestDebug';
import type { PlayerInfo } from '../../shared/types';
import type { ActiveRoom } from './types';
import type { Question } from './questions';

const roster: PlayerInfo[] = [{ id: 'host', name: 'Host' }, { id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];

const question: Question = { id: 'q1', category: 'Science', question: 'What?', choices: ['A', 'B', 'C', 'D'], correctIndex: 0 };

const room: ActiveRoom = { index: 0, isBoss: false, monsterHp: 3, monsterMaxHp: 3, question };

function makeCtx(overrides: Partial<Parameters<typeof useQuizQuestDebug>[0]> = {}) {
  return {
    isHost: true,
    playerId: 'host',
    roster,
    sendMessage: vi.fn(),
    phase: 'question' as const,
    room,
    answers: {},
    submitAnswer: vi.fn(),
    timeoutRound: vi.fn(),
    ...overrides,
  };
}

describe('useQuizQuestDebug', () => {
  it('only offers debug actions during the question phase', () => {
    expect(useQuizQuestDebug(makeCtx({ phase: 'party' })).getDebugActions()).toEqual([]);
    expect(useQuizQuestDebug(makeCtx({ phase: 'question' })).getDebugActions().length).toBe(2);
  });

  it('simulates an answer for every other player who has not answered yet', () => {
    const ctx = makeCtx({ answers: { a: 1 } }); // Alice already answered
    const { handleDebugHostAction } = useQuizQuestDebug(ctx);
    handleDebugHostAction('simulate-answers');

    // Host (the acting player) and Alice (already answered) are skipped.
    expect(ctx.submitAnswer).toHaveBeenCalledTimes(1);
    expect(ctx.submitAnswer).toHaveBeenCalledWith('b', expect.any(Number));
  });

  it('forces a timeout on request', () => {
    const ctx = makeCtx();
    const { handleDebugHostAction } = useQuizQuestDebug(ctx);
    handleDebugHostAction('force-timeout');
    expect(ctx.timeoutRound).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a non-host handling a host action directly', () => {
    const ctx = makeCtx({ isHost: false });
    const { handleDebugHostAction } = useQuizQuestDebug(ctx);
    handleDebugHostAction('simulate-answers');
    expect(ctx.submitAnswer).not.toHaveBeenCalled();
  });

  it('routes a non-host click through sendMessage instead of acting locally', () => {
    const ctx = makeCtx({ isHost: false });
    const { getDebugActions } = useQuizQuestDebug(ctx);
    const [simulate] = getDebugActions();
    simulate.onClick();

    expect(ctx.sendMessage).toHaveBeenCalledWith({
      type: 'quiz-debug-host-action',
      playerId: 'host',
      timestamp: expect.any(Number),
      payload: { action: 'simulate-answers' },
    });
    expect(ctx.submitAnswer).not.toHaveBeenCalled();
  });
});
