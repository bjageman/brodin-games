import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { PlayerInfo } from '../../shared/types';
import type { DebugAction } from '../../shared/components/DebugWidget';
import { buildDropdownOptions } from './utils/fallbackMerge';
import type { Matchup } from './utils/matchmaking';
import type {
  MatchupSide,
  MatchupStartPayload,
  MemoRandomPhase,
  PlayerAssignment,
  PlayerSheetResult,
  WordLibrary,
} from './types';

type TimerHandle = { id: ReturnType<typeof setTimeout>; callback: () => void; scheduledAt: number; delay: number };

interface MemoDebugCtx {
  isHost: boolean;
  playerId: string;
  sendMessage: (payload: unknown) => Promise<void>;
  phase: MemoRandomPhase;
  isTimerPaused: boolean;
  setIsTimerPaused: (v: boolean) => void;
  activeTimeoutRef: MutableRefObject<TimerHandle | null>;
  remainingTimeRef: MutableRefObject<number | null>;
  currentMatchup: MatchupStartPayload | null;
  setCurrentMatchup: Dispatch<SetStateAction<MatchupStartPayload | null>>;
  setRound1EndTimestamp: (v: number | null) => void;
  setRound2EndTimestamp: (v: number | null) => void;
  advanceToRound2: () => void;
  advanceToMatchups: () => void;
  finishMatch: (index: number) => void;
  startMatch: (index: number) => void;
  hostReceiveWordLibrary: (fromId: string, library: WordLibrary) => void;
  hostReceiveSheetSubmit: (fromId: string, answers: Record<string, string>) => void;
  hostReceiveVote: (fromId: string, matchIndex: number, side: MatchupSide | null, final: boolean) => void;
  rosterRef: MutableRefObject<PlayerInfo[]>;
  wordLibrariesRef: MutableRefObject<Map<string, WordLibrary>>;
  assignmentsRef: MutableRefObject<Record<string, PlayerAssignment>>;
  sheetsRef: MutableRefObject<Map<string, PlayerSheetResult>>;
  matchupsRef: MutableRefObject<Matchup[]>;
  currentMatchIndexRef: MutableRefObject<number>;
  matchVotedPlayersRef: MutableRefObject<Set<string>>;
}

// Memo-Random's dev-only host controls (timer pause/resume/adjust, skip phases,
// simulate other players). Extracted verbatim from the game component to keep it
// under size; every function reads the live game state from `ctx`.
export function useMemoRandomDebug(ctx: MemoDebugCtx) {
  const {
    isHost, playerId, sendMessage, phase, isTimerPaused, setIsTimerPaused,
    activeTimeoutRef, remainingTimeRef, currentMatchup, setCurrentMatchup,
    setRound1EndTimestamp, setRound2EndTimestamp, advanceToRound2, advanceToMatchups,
    finishMatch, startMatch, hostReceiveWordLibrary, hostReceiveSheetSubmit, hostReceiveVote,
    rosterRef, wordLibrariesRef, assignmentsRef, sheetsRef, matchupsRef,
    currentMatchIndexRef, matchVotedPlayersRef,
  } = ctx;

  const pauseTimer = () => {
    if (!isHost) {
      sendMessage({ type: 'debug-host-action', playerId, timestamp: Date.now(), payload: { action: 'pause-timer' } });
      return;
    }
    if (isTimerPaused || !activeTimeoutRef.current) return;
    
    clearTimeout(activeTimeoutRef.current.id);
    const elapsed = Date.now() - activeTimeoutRef.current.scheduledAt;
    const remaining = Math.max(0, activeTimeoutRef.current.delay - elapsed);
    remainingTimeRef.current = remaining;
    setIsTimerPaused(true);

    sendMessage({
      type: 'debug-timer-update',
      timestamp: Date.now(),
      payload: { endTimestamp: null, phase }
    });
  };

  const resumeTimer = () => {
    if (!isHost) {
      sendMessage({ type: 'debug-host-action', playerId, timestamp: Date.now(), payload: { action: 'resume-timer' } });
      return;
    }
    if (!isTimerPaused || !activeTimeoutRef.current) return;

    const remaining = remainingTimeRef.current ?? 10000;
    const newEndTimestamp = Date.now() + remaining;
    
    const callback = activeTimeoutRef.current.callback;
    const id = setTimeout(() => {
      activeTimeoutRef.current = null;
      callback();
    }, remaining);
    
    activeTimeoutRef.current = {
      id,
      callback,
      scheduledAt: Date.now(),
      delay: remaining
    };
    
    setIsTimerPaused(false);
    remainingTimeRef.current = null;

    sendMessage({
      type: 'debug-timer-update',
      timestamp: Date.now(),
      payload: { endTimestamp: newEndTimestamp, phase }
    });
    
    if (phase === 'round1') setRound1EndTimestamp(newEndTimestamp);
    else if (phase === 'round2') setRound2EndTimestamp(newEndTimestamp);
    else if (phase === 'matchup' && currentMatchup) {
      setCurrentMatchup(prev => prev ? { ...prev, endTimestamp: newEndTimestamp } : null);
    }
  };

  const adjustTimer = (seconds: number) => {
    if (!isHost) {
      sendMessage({ type: 'debug-host-action', playerId, timestamp: Date.now(), payload: { action: 'adjust-timer', seconds } });
      return;
    }
    if (!activeTimeoutRef.current) return;

    if (isTimerPaused) {
      const currentRemaining = remainingTimeRef.current ?? 0;
      remainingTimeRef.current = Math.max(0, currentRemaining + seconds * 1000);
      sendMessage({
        type: 'debug-timer-update',
        timestamp: Date.now(),
        payload: { endTimestamp: null, phase }
      });
      return;
    }

    const elapsed = Date.now() - activeTimeoutRef.current.scheduledAt;
    const currentRemaining = Math.max(0, activeTimeoutRef.current.delay - elapsed);
    const newRemaining = Math.max(0, currentRemaining + seconds * 1000);
    const newEndTimestamp = Date.now() + newRemaining;

    clearTimeout(activeTimeoutRef.current.id);
    const callback = activeTimeoutRef.current.callback;
    const id = setTimeout(() => {
      activeTimeoutRef.current = null;
      callback();
    }, newRemaining);

    activeTimeoutRef.current = {
      id,
      callback,
      scheduledAt: Date.now() - (activeTimeoutRef.current.delay - newRemaining),
      delay: newRemaining
    };

    sendMessage({
      type: 'debug-timer-update',
      timestamp: Date.now(),
      payload: { endTimestamp: newEndTimestamp, phase }
    });

    if (phase === 'round1') setRound1EndTimestamp(newEndTimestamp);
    else if (phase === 'round2') setRound2EndTimestamp(newEndTimestamp);
    else if (phase === 'matchup' && currentMatchup) {
      setCurrentMatchup(prev => prev ? { ...prev, endTimestamp: newEndTimestamp } : null);
    }
  };

  const simulateOtherPlayersWords = () => {
    const FALLBACK_WORDS = {
      noun: ['dog', 'cat', 'fox', 'house', 'tree', 'car', 'book', 'chair', 'apple', 'river', 'mountain', 'robot', 'pizza', 'guitar', 'bicycle'],
      verb: ['run', 'jump', 'walk', 'sing', 'dance', 'laugh', 'swim', 'climb', 'cook', 'paint', 'sleep', 'shout'],
      adjective: ['happy', 'blue', 'big', 'tiny', 'loud', 'quiet', 'shiny', 'fast', 'slow', 'brave', 'silly', 'ancient'],
      pronoun: []
    };
    rosterRef.current.forEach((player) => {
      if (player.id === playerId) return;
      if (wordLibrariesRef.current.has(player.id)) return;

      const library: WordLibrary = {
        noun: shuffled(FALLBACK_WORDS.noun).slice(0, 5),
        verb: shuffled(FALLBACK_WORDS.verb).slice(0, 5),
        adjective: shuffled(FALLBACK_WORDS.adjective).slice(0, 5),
        pronoun: []
      };
      hostReceiveWordLibrary(player.id, library);
    });
  };

  const simulateOtherPlayersSheets = () => {
    const expectedPlayers = Object.keys(assignmentsRef.current);
    expectedPlayers.forEach((pid) => {
      if (pid === playerId) return;
      if (sheetsRef.current.has(pid)) return;

      const assignment = assignmentsRef.current[pid];
      if (!assignment) return;

      const answers: Record<string, string> = {};
      const dropdownOptions = buildDropdownOptions(assignment.library, assignment.template, rosterRef.current.map(p => p.name));
      assignment.template.blanks.forEach((blank) => {
        const options = dropdownOptions[blank.id] || [];
        answers[blank.id] = options[Math.floor(Math.random() * options.length)] ?? '';
      });

      hostReceiveSheetSubmit(pid, answers);
    });
  };

  const simulateOtherPlayersVotes = () => {
    const matchup = matchupsRef.current[currentMatchIndexRef.current];
    if (!matchup) return;
    
    rosterRef.current.forEach((player) => {
      if (player.id === playerId) return;
      const isAuthor = player.id === matchup.left.playerId || player.id === matchup.right.playerId;
      if (isAuthor) return;
      if (matchVotedPlayersRef.current.has(player.id)) return;

      const side = Math.random() < 0.5 ? 'left' : 'right';
      hostReceiveVote(player.id, currentMatchIndexRef.current, side, true);
    });
  };

  function shuffled<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  const handleDebugHostAction = (action: string, payload?: Record<string, unknown>) => {
    if (!isHost) return;
    if (action === 'skip-round1') {
      advanceToRound2();
    } else if (action === 'skip-round2') {
      advanceToMatchups();
    } else if (action === 'skip-matchup') {
      finishMatch(currentMatchIndexRef.current);
    } else if (action === 'skip-results') {
      startMatch(currentMatchIndexRef.current + 1);
    } else if (action === 'pause-timer') {
      pauseTimer();
    } else if (action === 'resume-timer') {
      resumeTimer();
    } else if (action === 'adjust-timer') {
      adjustTimer((payload as { seconds?: number })?.seconds ?? 0);
    } else if (action === 'simulate-words') {
      simulateOtherPlayersWords();
    } else if (action === 'simulate-sheets') {
      simulateOtherPlayersSheets();
    } else if (action === 'simulate-votes') {
      simulateOtherPlayersVotes();
    }
  };

  const triggerAction = (action: string, extraPayload?: Record<string, unknown>) => {
    if (isHost) {
      handleDebugHostAction(action, extraPayload);
    } else {
      sendMessage({
        type: 'debug-host-action',
        playerId,
        timestamp: Date.now(),
        payload: { action, ...extraPayload }
      });
    }
  };

  const getDebugActions = () => {
    const actionsList: DebugAction[] = [];
    const hasTimer = ['round1', 'round2', 'matchup'].includes(phase);

    if (hasTimer) {
      if (isTimerPaused) {
        actionsList.push({
          label: '▶️ Resume Timer',
          onClick: () => triggerAction('resume-timer'),
          variant: 'success',
        });
      } else {
        actionsList.push({
          label: '⏸️ Pause Timer',
          onClick: () => triggerAction('pause-timer'),
          variant: 'warning',
        });
      }
      actionsList.push({
        label: '➕ Add 30s',
        onClick: () => triggerAction('adjust-timer', { seconds: 30 }),
        variant: 'secondary',
      });
      actionsList.push({
        label: '➖ Subtract 10s',
        onClick: () => triggerAction('adjust-timer', { seconds: -10 }),
        variant: 'secondary',
      });
    }

    if (phase === 'round1') {
      actionsList.push({
        label: '🤖 Simulate Words for Others',
        onClick: () => triggerAction('simulate-words'),
        variant: 'primary',
      });
      actionsList.push({
        label: '⏭️ Skip to Round 2',
        onClick: () => triggerAction('skip-round1'),
        variant: 'danger',
      });
    } else if (phase === 'round2') {
      actionsList.push({
        label: '🤖 Simulate Sheets for Others',
        onClick: () => triggerAction('simulate-sheets'),
        variant: 'primary',
      });
      actionsList.push({
        label: '⏭️ Skip to Matchups',
        onClick: () => triggerAction('skip-round2'),
        variant: 'danger',
      });
    } else if (phase === 'matchup') {
      actionsList.push({
        label: '🤖 Simulate Votes for Others',
        onClick: () => triggerAction('simulate-votes'),
        variant: 'primary',
      });
      actionsList.push({
        label: '⏭️ Skip Matchup',
        onClick: () => triggerAction('skip-matchup'),
        variant: 'danger',
      });
    } else if (phase === 'matchup-results') {
      actionsList.push({
        label: '⏭️ Skip Results Display',
        onClick: () => triggerAction('skip-results'),
        variant: 'danger',
      });
    }

    return actionsList;
  };

  return { handleDebugHostAction, getDebugActions };
}
