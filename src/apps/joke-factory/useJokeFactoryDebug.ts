import { useRef, useState, type MutableRefObject } from 'react';
import type { DebugAction } from '../../shared/components/DebugWidget';
import type { PlayerInfo } from '../../shared/types';
import type { JokeFactoryPhase, GameState, Prompt, PromptMatchup, Round3State } from './types';

interface JokeFactoryDebugCtx {
  isHost: boolean;
  playerId: string;
  sendMessage: (payload: unknown) => Promise<void> | void;
  phase: JokeFactoryPhase;
  round: number;
  roster: PlayerInfo[];
  promptsRef: MutableRefObject<Record<string, Prompt[]>>;
  matchupsRef: MutableRefObject<PromptMatchup[]>;
  currentMatchIndexRef: MutableRefObject<number>;
  round3Data: Round3State | null;
  revealEndTimestamp: number | null;
  writingEndTimestamp: number | null;
  votingEndTimestamp: number | null;
  resultsEndTimestamp: number | null;
  setRevealEndTimestamp: (v: number | null) => void;
  setWritingEndTimestamp: (v: number | null) => void;
  setVotingEndTimestamp: (v: number | null) => void;
  setResultsEndTimestamp: (v: number | null) => void;
  handleClientSubmitAnswers: (senderId: string, answers: Record<string, string>) => void;
  autoSubmitAnswers: () => void;
  handleClientSubmitVote: (senderId: string, choice: string) => void;
  revealRound3Results: (latestR3Data: Round3State) => void;
  revealMatchupResults: (latestMatchups: PromptMatchup[]) => void;
  handleResultsTimeout: () => void;
  handleNextRound: () => void;
  onQuit: () => void;
  broadcastState: (fields: Partial<GameState>) => void;
}

export function useJokeFactoryDebug(ctx: JokeFactoryDebugCtx) {
  const {
    isHost,
    playerId,
    sendMessage,
    phase,
    round,
    roster,
    promptsRef,
    matchupsRef,
    currentMatchIndexRef,
    round3Data,
    revealEndTimestamp,
    writingEndTimestamp,
    votingEndTimestamp,
    resultsEndTimestamp,
    setRevealEndTimestamp,
    setWritingEndTimestamp,
    setVotingEndTimestamp,
    setResultsEndTimestamp,
    handleClientSubmitAnswers,
    autoSubmitAnswers,
    handleClientSubmitVote,
    revealRound3Results,
    revealMatchupResults,
    handleResultsTimeout,
    handleNextRound,
    onQuit,
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

  const simulateAnswers = () => {
    if (!isHost) {
      sendMessage({
        type: 'debug-host-action',
        playerId,
        timestamp: Date.now(),
        payload: { action: 'simulate-answers' },
      });
      return;
    }
    roster.forEach((p) => {
      if (p.id !== playerId) {
        const prompts = promptsRef.current[p.id] || [];
        const answers: Record<string, string> = {};
        prompts.forEach((pr, idx) => {
          answers[pr.id] = `Funny joke ${idx + 1} from ${p.name}!`;
        });
        handleClientSubmitAnswers(p.id, answers);
      }
    });
  };

  const skipWriting = () => {
    if (!isHost) {
      sendMessage({
        type: 'debug-host-action',
        playerId,
        timestamp: Date.now(),
        payload: { action: 'skip-writing' },
      });
      return;
    }
    autoSubmitAnswers();
  };

  const simulateVotes = () => {
    if (!isHost) {
      sendMessage({
        type: 'debug-host-action',
        playerId,
        timestamp: Date.now(),
        payload: { action: 'simulate-votes' },
      });
      return;
    }
    if (round === 3) {
      if (!round3Data) return;
      roster.forEach((p) => {
        if (p.id !== playerId) {
          const options = roster.filter((item) => item.id !== p.id);
          if (options.length > 0) {
            const pick = options[Math.floor(Math.random() * options.length)].id;
            handleClientSubmitVote(p.id, pick);
          }
        }
      });
    } else {
      const currentMatch = matchupsRef.current[currentMatchIndexRef.current];
      if (!currentMatch) return;
      roster.forEach((p) => {
        if (p.id !== currentMatch.leftPlayerId && p.id !== currentMatch.rightPlayerId && p.id !== playerId) {
          const pick = Math.random() > 0.5 ? 'left' : 'right';
          handleClientSubmitVote(p.id, pick);
        }
      });
    }
  };

  const skipMatchup = () => {
    if (!isHost) {
      sendMessage({
        type: 'debug-host-action',
        playerId,
        timestamp: Date.now(),
        payload: { action: 'skip-matchup' },
      });
      return;
    }
    if (round === 3) {
      if (round3Data) revealRound3Results(round3Data);
    } else {
      revealMatchupResults(matchupsRef.current);
    }
  };

  const skipResults = () => {
    if (!isHost) {
      sendMessage({
        type: 'debug-host-action',
        playerId,
        timestamp: Date.now(),
        payload: { action: 'skip-results' },
      });
      return;
    }
    handleResultsTimeout();
  };

  const nextRound = () => {
    if (!isHost) {
      sendMessage({
        type: 'debug-host-action',
        playerId,
        timestamp: Date.now(),
        payload: { action: 'next-round' },
      });
      return;
    }
    handleNextRound();
  };

  const endGameAction = () => {
    if (!isHost) {
      sendMessage({
        type: 'debug-host-action',
        playerId,
        timestamp: Date.now(),
        payload: { action: 'end-game' },
      });
      return;
    }
    onQuit();
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
        onClick: () => simulateAnswers(),
        variant: 'success',
      });
      actionsList.push({
        label: '⏭️ Skip Writing Phase',
        onClick: () => skipWriting(),
        variant: 'warning',
      });
    } else if (phase === 'voting') {
      actionsList.push({
        label: '🤖 Simulate Votes for Others',
        onClick: () => simulateVotes(),
        variant: 'success',
      });
      actionsList.push({
        label: '⏭️ Skip Matchup',
        onClick: () => skipMatchup(),
        variant: 'warning',
      });
    } else if (phase === 'results') {
      actionsList.push({
        label: '⏭️ Skip Results Display',
        onClick: () => skipResults(),
        variant: 'warning',
      });
    } else if (phase === 'leaderboard') {
      if (round < 3) {
        actionsList.push({
          label: `Start Round ${round + 1}`,
          onClick: () => nextRound(),
          variant: 'primary',
        });
      } else {
        actionsList.push({
          label: 'End Game',
          onClick: () => endGameAction(),
          variant: 'danger',
        });
      }
    }

    return actionsList;
  };

  return { isTimerPaused, handleDebugHostAction, getDebugActions };
}
