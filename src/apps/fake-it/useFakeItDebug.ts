import { useRef, useState } from 'react';
import type { DebugAction } from '../../shared/components/DebugWidget';
import type { PlayerInfo } from '../../shared/types';
import type { FakeItPhase, GameState, Line } from './types';
import { TURN_DURATION_MS, VOTE_DURATION_MS } from './constants';

interface FakeItDebugCtx {
  isHost: boolean;
  playerId: string;
  sendMessage: (payload: unknown) => Promise<void>;
  phase: FakeItPhase;
  roster: PlayerInfo[];
  drawerIndex: number;
  lines: Line[];
  votes: Record<string, string>;
  roleRevealEndTimestamp: number | null;
  turnEndTimestamp: number | null;
  voteEndTimestamp: number | null;
  setRoleRevealEndTimestamp: (v: number | null) => void;
  setTurnEndTimestamp: (v: number | null) => void;
  setVoteEndTimestamp: (v: number | null) => void;
  setPhase: (v: FakeItPhase) => void;
  setLines: (v: Line[]) => void;
  setVotes: (v: Record<string, string>) => void;
  broadcastState: (fields: Partial<GameState>) => void;
  advanceTurn: (currentLines: Line[]) => void;
  revealResults: (finalVotes: Record<string, string>) => void;
  getPlayerColor: (pId: string) => string;
}

// Fake It's dev-only host controls (skip phases, pause/adjust the timer, simulate
// other players). Extracted from the game component to keep it under size; the
// function bodies are unchanged and read the live game state from `ctx`.
export function useFakeItDebug(ctx: FakeItDebugCtx) {
  const {
    isHost, playerId, sendMessage, phase, roster, drawerIndex, lines, votes,
    roleRevealEndTimestamp, turnEndTimestamp, voteEndTimestamp,
    setRoleRevealEndTimestamp, setTurnEndTimestamp, setVoteEndTimestamp,
    setPhase, setLines, setVotes, broadcastState, advanceTurn, revealResults, getPlayerColor,
  } = ctx;

  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const remainingTimeRef = useRef<number | null>(null);

  const getActiveTimestamp = () => {
    if (phase === 'role-reveal') return roleRevealEndTimestamp;
    if (phase === 'drawing') return turnEndTimestamp;
    if (phase === 'voting') return voteEndTimestamp;
    return null;
  };

  const setActiveTimestamp = (val: number | null) => {
    if (phase === 'role-reveal') {
      setRoleRevealEndTimestamp(val);
      broadcastState({ roleRevealEndTimestamp: val });
    } else if (phase === 'drawing') {
      setTurnEndTimestamp(val);
      broadcastState({ turnEndTimestamp: val });
    } else if (phase === 'voting') {
      setVoteEndTimestamp(val);
      broadcastState({ voteEndTimestamp: val });
    }
  };

  const pauseTimer = () => {
    if (!isHost) {
      sendMessage({ type: 'debug-host-action', playerId, timestamp: Date.now(), payload: { action: 'pause-timer' } });
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
      sendMessage({ type: 'debug-host-action', playerId, timestamp: Date.now(), payload: { action: 'resume-timer' } });
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
      sendMessage({ type: 'debug-host-action', playerId, timestamp: Date.now(), payload: { action: 'adjust-timer', seconds } });
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

  const simulateCurrentDrawerDrawing = () => {
    const points = [
      { x: Math.random() * 400 + 50, y: Math.random() * 400 + 50 },
      { x: Math.random() * 400 + 50, y: Math.random() * 400 + 50 }
    ];
    const currentDrawer = roster[drawerIndex];
    if (!currentDrawer) return;
    
    const newLine: Line = {
      points,
      color: getPlayerColor(currentDrawer.id),
      playerId: currentDrawer.id,
      playerName: currentDrawer.name
    };
    
    const nextLines = [...lines, newLine];
    setLines(nextLines);
    advanceTurn(nextLines);
  };

  const simulateOtherPlayersVotes = () => {
    const nextVotes = { ...votes };
    roster.forEach((player) => {
      if (player.id === playerId) return;
      if (nextVotes[player.id]) return;
      
      const options = roster.filter(p => p.id !== player.id);
      const chosen = options[Math.floor(Math.random() * options.length)];
      if (chosen) {
        nextVotes[player.id] = chosen.id;
      }
    });

    setVotes(nextVotes);
    
    const voterCount = Object.keys(nextVotes).length;
    if (voterCount >= roster.length) {
      revealResults(nextVotes);
    } else {
      broadcastState({ votes: nextVotes });
    }
  };

  const handleDebugHostAction = (action: string, payloadObj?: Record<string, unknown>) => {
    if (!isHost) return;
    if (action === 'skip-reveal') {
      const endTimestamp = Date.now() + TURN_DURATION_MS;
      setPhase('drawing');
      setRoleRevealEndTimestamp(null);
      setTurnEndTimestamp(endTimestamp);
      broadcastState({
        phase: 'drawing',
        roleRevealEndTimestamp: null,
        turnEndTimestamp: endTimestamp,
      });
    } else if (action === 'skip-turn') {
      advanceTurn(lines);
    } else if (action === 'skip-drawing') {
      const endTimestamp = Date.now() + VOTE_DURATION_MS;
      setPhase('voting');
      setTurnEndTimestamp(null);
      setVoteEndTimestamp(endTimestamp);
      broadcastState({
        phase: 'voting',
        lines,
        drawerIndex: 0,
        drawingRound: 3,
        turnEndTimestamp: null,
        voteEndTimestamp: endTimestamp,
      });
    } else if (action === 'skip-voting') {
      revealResults(votes);
    } else if (action === 'pause-timer') {
      pauseTimer();
    } else if (action === 'resume-timer') {
      resumeTimer();
    } else if (action === 'adjust-timer') {
      adjustTimer((payloadObj as { seconds?: number })?.seconds ?? 0);
    } else if (action === 'simulate-drawing') {
      simulateCurrentDrawerDrawing();
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
    const hasTimer = ['role-reveal', 'drawing', 'voting'].includes(phase);

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

    if (phase === 'role-reveal') {
      actionsList.push({
        label: '⏭️ Skip Reveal',
        onClick: () => triggerAction('skip-reveal'),
        variant: 'danger',
      });
    } else if (phase === 'drawing') {
      actionsList.push({
        label: '✏️ Simulate Drawer Drawing',
        onClick: () => triggerAction('simulate-drawing'),
        variant: 'primary',
      });
      actionsList.push({
        label: '⏭️ Skip Drawing Turn',
        onClick: () => triggerAction('skip-turn'),
        variant: 'warning',
      });
      actionsList.push({
        label: '⏭️ Skip All Drawing Turns',
        onClick: () => triggerAction('skip-drawing'),
        variant: 'danger',
      });
    } else if (phase === 'voting') {
      actionsList.push({
        label: '🤖 Simulate Roster Votes',
        onClick: () => triggerAction('simulate-votes'),
        variant: 'primary',
      });
      actionsList.push({
        label: '⏭️ Skip Voting (Tally)',
        onClick: () => triggerAction('skip-voting'),
        variant: 'danger',
      });
    }

    return actionsList;
  };

  return { isTimerPaused, handleDebugHostAction, getDebugActions };
}
