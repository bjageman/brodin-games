import { useRef, useState } from 'react';
import type { DebugAction } from '../../shared/components/DebugWidget';
import type { JokeFactoryPhase, GameState } from './types';

interface JokeFactoryDebugCtx {
  isHost: boolean;
  playerId: string;
  sendMessage: (payload: unknown) => Promise<void> | void;
  phase: JokeFactoryPhase;
  round: number;
  revealEndTimestamp: number | null;
  writingEndTimestamp: number | null;
  votingEndTimestamp: number | null;
  resultsEndTimestamp: number | null;
  setRevealEndTimestamp: (v: number | null) => void;
  setWritingEndTimestamp: (v: number | null) => void;
  setVotingEndTimestamp: (v: number | null) => void;
  setResultsEndTimestamp: (v: number | null) => void;
  simulateAnswers: () => void;
  skipWriting: () => void;
  simulateVotes: () => void;
  skipMatchup: () => void;
  skipResults: () => void;
  nextRound: () => void;
  endGameAction: () => void;
  broadcastState: (fields: Partial<GameState>) => void;
}

export function useJokeFactoryDebug(ctx: JokeFactoryDebugCtx) {
  const {
    isHost,
    playerId,
    sendMessage,
    phase,
    round,
    revealEndTimestamp,
    writingEndTimestamp,
    votingEndTimestamp,
    resultsEndTimestamp,
    setRevealEndTimestamp,
    setWritingEndTimestamp,
    setVotingEndTimestamp,
    setResultsEndTimestamp,
    simulateAnswers,
    skipWriting,
    simulateVotes,
    skipMatchup,
    skipResults,
    nextRound,
    endGameAction,
    broadcastState,
  } = ctx;

  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const remainingTimeRef = useRef<number | null>(null);

  const getActiveTimestamp = () => {
    if (phase === 'prompt-reveal') return revealEndTimestamp;
    if (phase === 'writing') return writingEndTimestamp;
    if (phase === 'voting') return votingEndTimestamp;
    if (phase === 'results') return resultsEndTimestamp;
    return null;
  };

  const setActiveTimestamp = (val: number | null) => {
    if (phase === 'prompt-reveal') {
      setRevealEndTimestamp(val);
    } else if (phase === 'writing') {
      setWritingEndTimestamp(val);
      broadcastState({ writingEndTimestamp: val });
    } else if (phase === 'voting') {
      setVotingEndTimestamp(val);
      broadcastState({ votingEndTimestamp: val });
    } else if (phase === 'results') {
      setResultsEndTimestamp(val);
      broadcastState({ resultsEndTimestamp: val });
    }
  };

  const pauseTimer = () => {
    if (!isHost) {
      sendMessage({
        type: 'debug-host-action',
        playerId,
        timestamp: Date.now(),
        payload: { action: 'pause-timer' },
      });
      return;
    }
    const endTimestamp = getActiveTimestamp();
    if (isTimerPaused || !endTimestamp) return;

    const remaining = Math.max(0, endTimestamp - Date.now());
    remainingTimeRef.current = remaining;
    setIsTimerPaused(true);
    setActiveTimestamp(null);
  };

  const resumeTimer = () => {
    if (!isHost) {
      sendMessage({
        type: 'debug-host-action',
        playerId,
        timestamp: Date.now(),
        payload: { action: 'resume-timer' },
      });
      return;
    }
    if (!isTimerPaused || remainingTimeRef.current === null) return;

    const newEndTimestamp = Date.now() + remainingTimeRef.current;
    setIsTimerPaused(false);
    remainingTimeRef.current = null;
    setActiveTimestamp(newEndTimestamp);
  };

  const adjustTimer = (seconds: number) => {
    if (!isHost) {
      sendMessage({
        type: 'debug-host-action',
        playerId,
        timestamp: Date.now(),
        payload: { action: 'adjust-timer', seconds },
      });
      return;
    }
    if (isTimerPaused) {
      const remaining = remainingTimeRef.current ?? 0;
      remainingTimeRef.current = Math.max(0, remaining + seconds * 1000);
      return;
    }

    const endTimestamp = getActiveTimestamp();
    if (!endTimestamp) return;

    const newEndTimestamp = Math.max(Date.now(), endTimestamp + seconds * 1000);
    setActiveTimestamp(newEndTimestamp);
  };

  const handleDebugHostAction = (action: string, payloadObj?: Record<string, unknown>) => {
    if (!isHost) return;
    if (action === 'pause-timer') {
      pauseTimer();
    } else if (action === 'resume-timer') {
      resumeTimer();
    } else if (action === 'adjust-timer') {
      adjustTimer((payloadObj as { seconds?: number })?.seconds ?? 0);
    } else if (action === 'simulate-answers') {
      simulateAnswers();
    } else if (action === 'skip-writing') {
      skipWriting();
    } else if (action === 'simulate-votes') {
      simulateVotes();
    } else if (action === 'skip-matchup') {
      skipMatchup();
    } else if (action === 'skip-results') {
      skipResults();
    } else if (action === 'next-round') {
      nextRound();
    } else if (action === 'end-game') {
      endGameAction();
    }
  };

  const getDebugActions = () => {
    const actionsList: DebugAction[] = [];
    const hasTimer = ['prompt-reveal', 'writing', 'voting', 'results'].includes(phase);

    if (hasTimer) {
      if (isTimerPaused) {
        actionsList.push({
          label: '▶️ Resume Timer',
          onClick: () => resumeTimer(),
          variant: 'success',
        });
      } else {
        actionsList.push({
          label: '⏸️ Pause Timer',
          onClick: () => pauseTimer(),
          variant: 'warning',
        });
      }
      actionsList.push({
        label: '➕ Add 30s',
        onClick: () => adjustTimer(30),
        variant: 'secondary',
      });
      actionsList.push({
        label: '➖ Subtract 10s',
        onClick: () => adjustTimer(-10),
        variant: 'secondary',
      });
    }

    if (phase === 'writing') {
      actionsList.push({
        label: '🤖 Simulate Answers for Others',
        onClick: () => {
          if (isHost) {
            simulateAnswers();
          } else {
            sendMessage({
              type: 'debug-host-action',
              playerId,
              timestamp: Date.now(),
              payload: { action: 'simulate-answers' },
            });
          }
        },
        variant: 'success',
      });
      actionsList.push({
        label: '⏭️ Skip Writing Phase',
        onClick: () => {
          if (isHost) {
            skipWriting();
          } else {
            sendMessage({
              type: 'debug-host-action',
              playerId,
              timestamp: Date.now(),
              payload: { action: 'skip-writing' },
            });
          }
        },
        variant: 'warning',
      });
    } else if (phase === 'voting') {
      actionsList.push({
        label: '🤖 Simulate Votes for Others',
        onClick: () => {
          if (isHost) {
            simulateVotes();
          } else {
            sendMessage({
              type: 'debug-host-action',
              playerId,
              timestamp: Date.now(),
              payload: { action: 'simulate-votes' },
            });
          }
        },
        variant: 'success',
      });
      actionsList.push({
        label: '⏭️ Skip Matchup',
        onClick: () => {
          if (isHost) {
            skipMatchup();
          } else {
            sendMessage({
              type: 'debug-host-action',
              playerId,
              timestamp: Date.now(),
              payload: { action: 'skip-matchup' },
            });
          }
        },
        variant: 'warning',
      });
    } else if (phase === 'results') {
      actionsList.push({
        label: '⏭️ Skip Results Display',
        onClick: () => {
          if (isHost) {
            skipResults();
          } else {
            sendMessage({
              type: 'debug-host-action',
              playerId,
              timestamp: Date.now(),
              payload: { action: 'skip-results' },
            });
          }
        },
        variant: 'warning',
      });
    } else if (phase === 'leaderboard') {
      if (round < 3) {
        actionsList.push({
          label: `Start Round ${round + 1}`,
          onClick: () => {
            if (isHost) {
              nextRound();
            } else {
              sendMessage({
                type: 'debug-host-action',
                playerId,
                timestamp: Date.now(),
                payload: { action: 'next-round' },
              });
            }
          },
          variant: 'primary',
        });
      } else {
        actionsList.push({
          label: 'End Game',
          onClick: () => {
            if (isHost) {
              endGameAction();
            } else {
              sendMessage({
                type: 'debug-host-action',
                playerId,
                timestamp: Date.now(),
                payload: { action: 'end-game' },
              });
            }
          },
          variant: 'danger',
        });
      }
    }

    return actionsList;
  };

  return { isTimerPaused, handleDebugHostAction, getDebugActions };
}
