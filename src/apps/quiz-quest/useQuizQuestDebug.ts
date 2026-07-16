import type { DebugAction } from '../../shared/components/DebugWidget';
import type { PlayerInfo } from '../../shared/types';
import type { ActiveRoom, QuizPhase } from './types';

interface QuizQuestDebugCtx {
  isHost: boolean;
  playerId: string;
  roster: PlayerInfo[];
  sendMessage: (payload: unknown) => Promise<void> | void;
  phase: QuizPhase;
  room: ActiveRoom | null;
  answers: Record<string, number>;
  submitAnswer: (senderId: string | undefined, choiceIndex: number) => void;
  timeoutRound: () => void;
}

// Everything the host-only debug widget needs to unblock testing: bots can't
// pick up a phone to answer a question, so without this a solo host has no
// way to see the room loop move past round 1.
export function useQuizQuestDebug(ctx: QuizQuestDebugCtx) {
  const { isHost, playerId, roster, sendMessage, phase, room, answers, submitAnswer, timeoutRound } = ctx;

  // A mix of right and wrong answers, same as a real crowd would produce, so
  // scoring/HP/ghost/loot paths all get exercised while testing solo.
  function simulateAnswersForOthers() {
    if (!room) return;
    const choiceCount = room.question.choices.length;
    roster.forEach((p) => {
      if (p.id === playerId || answers[p.id] !== undefined) return;
      submitAnswer(p.id, Math.floor(Math.random() * choiceCount));
    });
  }

  function handleDebugHostAction(action: string) {
    if (!isHost) return;
    if (action === 'simulate-answers') simulateAnswersForOthers();
    else if (action === 'force-timeout') timeoutRound();
  }

  function triggerAction(action: string) {
    if (isHost) handleDebugHostAction(action);
    else sendMessage({ type: 'quiz-debug-host-action', playerId, timestamp: Date.now(), payload: { action } });
  }

  function getDebugActions(): DebugAction[] {
    const list: DebugAction[] = [];
    if (phase === 'question') {
      list.push({ label: '🤖 Simulate Answers for Others', onClick: () => triggerAction('simulate-answers'), variant: 'success' });
      list.push({ label: '⏭️ Force Timeout', onClick: () => triggerAction('force-timeout'), variant: 'warning' });
    }
    return list;
  }

  return { handleDebugHostAction, getDebugActions };
}
