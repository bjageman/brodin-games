import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useCountdown } from '../../shared/hooks/useCountdown';
import type { Envelope } from '../../shared/types';
import type { GamePlayProps } from '../../shared/GameShell';
import type { FakeItPhase, GameState, Line, Topic, Point } from './types';
import { DEBUG_MODE } from '../../shared/constants';
import {
  ROLE_REVEAL_DURATION_MS,
  TURN_DURATION_MS,
  VOTE_DURATION_MS,
  DRAWING_COLORS,
  pickTopic,
  STATE_REQUEST_RETRY_INTERVAL_MS,
  STATE_REQUEST_MAX_ATTEMPTS,
  PAYOUT_CORRECT_VOTE,
  PAYOUT_IMPOSTER_ESCAPED,
} from './constants';
import FakeItScreens from './components/FakeItViews';
import { useFakeItDebug } from './useFakeItDebug';


interface FakeItSnapshot {
  gamePhase: FakeItPhase;
  imposterId: string;
  topic: Topic | null;
  drawerIndex: number;
  drawingRound: number;
  lines: Line[];
  votes: Record<string, string>;
  scores: Record<string, number>;
  roundPoints: Record<string, number>;
  roleRevealEndTimestamp: number | null;
  turnEndTimestamp: number | null;
  voteEndTimestamp: number | null;
  usedTopicNames: string[];
}

const CONFETTI_COLORS = ['#f9749f', '#03d1b9', '#facc15'];

// Phases the mockups draw on a dark stage: the prompt reveal, the drawing
// easel, and the round payout. Lobby / vote / final tally are light.
const DARK_PHASES = new Set<FakeItPhase>(['starting', 'role-reveal', 'drawing', 'results']);

export default function FakeItGame({
  code,
  playerId,
  isHost,
  roster,
  sendMessage,
  freshStart,
  onRegisterMessageHandler,
  onQuit,
  onRegisterDebugActions,
  onGameBgChange,
}: GamePlayProps) {
  // Restore state from snapshot if not a fresh start
  const restored = freshStart ? null : JSON.parse(sessionStorage.getItem(`fake-it-snap-${code}`) || 'null') as FakeItSnapshot | null;

  const [phase, setPhase] = useState<FakeItPhase>(restored?.gamePhase ?? 'starting');
  const [imposterId, setImposterId] = useState<string>(restored?.imposterId ?? '');
  const [topic, setTopic] = useState<Topic | null>(restored?.topic ?? null);
  // Host-only: topics already played this game, so rounds don't repeat a word.
  const [usedTopicNames, setUsedTopicNames] = useState<string[]>(restored?.usedTopicNames ?? []);
  const [drawerIndex, setDrawerIndex] = useState<number>(restored?.drawerIndex ?? 0);
  const [drawingRound, setDrawingRound] = useState<number>(restored?.drawingRound ?? 1);
  const [lines, setLines] = useState<Line[]>(restored?.lines ?? []);
  const [votes, setVotes] = useState<Record<string, string>>(restored?.votes ?? {});
  const [scores, setScores] = useState<Record<string, number>>(restored?.scores ?? {});
  const [roundPoints, setRoundPoints] = useState<Record<string, number>>(restored?.roundPoints ?? {});

  const [roleRevealEndTimestamp, setRoleRevealEndTimestamp] = useState<number | null>(restored?.roleRevealEndTimestamp ?? null);
  const [turnEndTimestamp, setTurnEndTimestamp] = useState<number | null>(restored?.turnEndTimestamp ?? null);
  const [voteEndTimestamp, setVoteEndTimestamp] = useState<number | null>(restored?.voteEndTimestamp ?? null);


  const [myVote, setMyVote] = useState<string | null>(null);

  // Dev-only host controls (hoisted helpers below are passed in as context).
  const { isTimerPaused, handleDebugHostAction, getDebugActions } = useFakeItDebug({
    isHost, playerId, sendMessage, phase, roster, drawerIndex, lines, votes,
    roleRevealEndTimestamp, turnEndTimestamp, voteEndTimestamp,
    setRoleRevealEndTimestamp, setTurnEndTimestamp, setVoteEndTimestamp,
    setPhase, setLines, setVotes, broadcastState, advanceTurn, revealResults, getPlayerColor,
  });

  // Save state snapshots on change
  useEffect(() => {
    const snapshot: FakeItSnapshot = {
      gamePhase: phase,
      imposterId,
      topic,
      drawerIndex,
      drawingRound,
      lines,
      votes,
      scores,
      roundPoints,
      roleRevealEndTimestamp,
      turnEndTimestamp,
      voteEndTimestamp,
      usedTopicNames,
    };
    sessionStorage.setItem(`fake-it-snap-${code}`, JSON.stringify(snapshot));
  }, [
    code,
    phase,
    imposterId,
    topic,
    drawerIndex,
    drawingRound,
    lines,
    votes,
    scores,
    roundPoints,
    usedTopicNames,
    roleRevealEndTimestamp,
    turnEndTimestamp,
    voteEndTimestamp,
  ]);

  // Timers using useCountdown
  const { msRemaining: revealMs, expired: revealExpired } = useCountdown(roleRevealEndTimestamp);
  const { msRemaining: turnMs, expired: turnExpired } = useCountdown(turnEndTimestamp);
  const { msRemaining: voteMs, expired: voteExpired } = useCountdown(voteEndTimestamp);

  const revealSec = Math.ceil(revealMs / 1000);
  const turnSec = Math.ceil(turnMs / 1000);
  const voteSec = Math.ceil(voteMs / 1000);

  // Get color for a player index
  function getPlayerColor(pId: string) {
    const pIndex = roster.findIndex((p) => p.id === pId);
    return pIndex >= 0 ? DRAWING_COLORS[pIndex % DRAWING_COLORS.length] : '#9ca3af';
  }

  // Helper to broadcast state from host
  function broadcastState(fields: Partial<GameState>) {
    const fullState: GameState = {
      phase,
      imposterId,
      topic,
      drawerIndex,
      drawingRound,
      lines,
      votes,
      scores,
      roundPoints,
      roleRevealEndTimestamp,
      turnEndTimestamp,
      voteEndTimestamp,
      ...fields,
    };
    sendMessage({
      type: 'fake-it-state-update',
      timestamp: Date.now(),
      payload: fullState,
    });
  }

  // Handle drawing turn timeout on host
  function handleTurnTimeout() {
    advanceTurn(lines);
  }

  // Helper to advance the drawing turn
  function advanceTurn(currentLines: Line[]) {
    let nextDrawerIndex = drawerIndex + 1;
    let nextDrawingRound = drawingRound;

    if (nextDrawerIndex >= roster.length) {
      nextDrawerIndex = 0;
      nextDrawingRound += 1;
    }

    if (nextDrawingRound > 2) {
      // Drawing finished! Go to voting
      const endTimestamp = Date.now() + VOTE_DURATION_MS;
      setPhase('voting');
      setTurnEndTimestamp(null);
      setVoteEndTimestamp(endTimestamp);

      broadcastState({
        phase: 'voting',
        lines: currentLines,
        drawerIndex: 0,
        drawingRound: nextDrawingRound,
        turnEndTimestamp: null,
        voteEndTimestamp: endTimestamp,
      });
    } else {
      // Next drawer
      const endTimestamp = Date.now() + TURN_DURATION_MS;
      setDrawerIndex(nextDrawerIndex);
      setDrawingRound(nextDrawingRound);
      setTurnEndTimestamp(endTimestamp);

      broadcastState({
        lines: currentLines,
        drawerIndex: nextDrawerIndex,
        drawingRound: nextDrawingRound,
        turnEndTimestamp: endTimestamp,
      });
    }
  }

  // Host: Process client drawn line
  function handleClientDrawLine(senderId: string | undefined, points: Point[]) {
    if (!senderId) return;
    const currentDrawer = roster[drawerIndex];
    if (!currentDrawer || currentDrawer.id !== senderId) return;

    const newLine: Line = {
      playerId: currentDrawer.id,
      playerName: currentDrawer.name,
      color: getPlayerColor(currentDrawer.id),
      points,
    };

    const nextLines = [...lines, newLine];
    setLines(nextLines);
    advanceTurn(nextLines);
  }

  // Host: Process client vote
  function handleClientSubmitVote(senderId: string | undefined, targetId: string) {
    if (!senderId) return;

    const nextVotes = { ...votes, [senderId]: targetId };
    setVotes(nextVotes);

    const activeVoters = roster.length;
    const submittedVotes = Object.keys(nextVotes).length;

    if (submittedVotes >= activeVoters) {
      revealResults(nextVotes);
    } else {
      // Broadcast updated votes list so players see checkmarks
      broadcastState({
        votes: nextVotes,
      });
    }
  }

  // Host: Calculate scores and transition to results
  function revealResults(finalVotes: Record<string, string>) {
    const voteCounts: Record<string, number> = {};
    roster.forEach((p) => {
      voteCounts[p.id] = 0;
    });
    Object.values(finalVotes).forEach((votedId) => {
      if (voteCounts[votedId] !== undefined) {
        voteCounts[votedId]++;
      }
    });

    const maxVotes = Math.max(...Object.values(voteCounts), 0);
    const votedOutIds = Object.keys(voteCounts).filter((id) => voteCounts[id] === maxVotes && maxVotes > 0);

    const imposterCaught = votedOutIds.includes(imposterId);

    const newRoundPoints: Record<string, number> = {};
    roster.forEach((p) => {
      newRoundPoints[p.id] = 0;
    });

    if (imposterCaught) {
      // Artists won! Everyone who fingered the imposter gets paid.
      Object.entries(finalVotes).forEach(([voterId, votedId]) => {
        if (votedId === imposterId) {
          newRoundPoints[voterId] = PAYOUT_CORRECT_VOTE;
        }
      });
    } else {
      // Imposter slipped through and collects the bigger purse.
      newRoundPoints[imposterId] = PAYOUT_IMPOSTER_ESCAPED;
    }

    const nextScores = { ...scores };
    roster.forEach((p) => {
      nextScores[p.id] = (nextScores[p.id] || 0) + (newRoundPoints[p.id] || 0);
    });

    setPhase('results');
    setVotes(finalVotes);
    setScores(nextScores);
    setRoundPoints(newRoundPoints);
    setVoteEndTimestamp(null);

    broadcastState({
      phase: 'results',
      votes: finalVotes,
      scores: nextScores,
      roundPoints: newRoundPoints,
      voteEndTimestamp: null,
    });
  }

  // Host: Start next round/reset state
  function handleNextRound() {
    const { topic: randomTopic, usedNames } = pickTopic(usedTopicNames);
    setUsedTopicNames(usedNames);
    const randomImposter = roster[Math.floor(Math.random() * roster.length)];
    const revealEnd = Date.now() + ROLE_REVEAL_DURATION_MS;

    setPhase('role-reveal');
    setImposterId(randomImposter.id);
    setTopic(randomTopic);
    setDrawerIndex(0);
    setDrawingRound(1);
    setLines([]);
    setVotes({});
    setRoundPoints({});
    setRoleRevealEndTimestamp(revealEnd);
    setTurnEndTimestamp(null);
    setVoteEndTimestamp(null);

    broadcastState({
      phase: 'role-reveal',
      imposterId: randomImposter.id,
      topic: randomTopic,
      drawerIndex: 0,
      drawingRound: 1,
      lines: [],
      votes: {},
      roundPoints: {},
      roleRevealEndTimestamp: revealEnd,
      turnEndTimestamp: null,
      voteEndTimestamp: null,
    });
  }

  // Host: Trigger play-again back to lobby
  function playAgain() {
    sendMessage({ type: 'play-again', timestamp: Date.now(), payload: {} });
  }

  // Client: Submit drawing line
  function handleDrawEnd(points: Point[]) {
    sendMessage({
      type: 'draw-line',
      playerId,
      timestamp: Date.now(),
      payload: { points },
    });
  }

  // Client: Submit imposter vote
  function handleVoteSubmit(targetId: string) {
    setMyVote(targetId);
    sendMessage({
      type: 'submit-vote',
      playerId,
      timestamp: Date.now(),
      payload: { targetId },
    });
  }

  // Initialize Game (Host only)
  useEffect(() => {
    if (isHost && (phase === 'starting' || freshStart)) {
      const activePlayers = roster;
      if (activePlayers.length === 0) return;

      const { topic: randomTopic, usedNames } = pickTopic(usedTopicNames);
      const randomImposter = activePlayers[Math.floor(Math.random() * activePlayers.length)];

      const initialScores = { ...scores };
      activePlayers.forEach((p) => {
        if (initialScores[p.id] === undefined) {
          initialScores[p.id] = 0;
        }
      });

      const revealEnd = Date.now() + ROLE_REVEAL_DURATION_MS;

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('role-reveal');
      setImposterId(randomImposter.id);
      setTopic(randomTopic);
      setUsedTopicNames(usedNames);
      setDrawerIndex(0);
      setDrawingRound(1);
      setLines([]);
      setVotes({});
      setScores(initialScores);
      setRoundPoints({});
      setRoleRevealEndTimestamp(revealEnd);
      setTurnEndTimestamp(null);
      setVoteEndTimestamp(null);

      // Broadcast immediately
      const newState: GameState = {
        phase: 'role-reveal',
        imposterId: randomImposter.id,
        topic: randomTopic,
        drawerIndex: 0,
        drawingRound: 1,
        lines: [],
        votes: {},
        scores: initialScores,
        roundPoints: {},
        roleRevealEndTimestamp: revealEnd,
        turnEndTimestamp: null,
        voteEndTimestamp: null,
      };

      sendMessage({
        type: 'fake-it-state-update',
        timestamp: Date.now(),
        payload: newState,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, freshStart, roster.length]);

  // Client recovery: if we're still on the loading screen ('starting') after
  // mounting, we likely missed the host's one-shot initial state broadcast
  // (a race: the broadcast can arrive before our message handler registers).
  // Poll the host for the current state until it lands or we give up.
  useEffect(() => {
    if (isHost || phase !== 'starting') return;
    let attempts = 0;
    const trySend = () => {
      sendMessage({ type: 'fake-it-request-state', playerId, timestamp: Date.now(), payload: {} });
      attempts++;
      if (attempts >= STATE_REQUEST_MAX_ATTEMPTS) clearInterval(interval);
    };
    trySend();
    const interval = setInterval(trySend, STATE_REQUEST_RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isHost, phase, playerId, sendMessage]);

  // Host transition: Role Reveal -> Drawing
  useEffect(() => {
    if (isHost && phase === 'role-reveal' && roleRevealEndTimestamp && revealExpired) {
      const endTimestamp = Date.now() + TURN_DURATION_MS;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('drawing');
      setRoleRevealEndTimestamp(null);
      setTurnEndTimestamp(endTimestamp);

      broadcastState({
        phase: 'drawing',
        roleRevealEndTimestamp: null,
        turnEndTimestamp: endTimestamp,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, phase, roleRevealEndTimestamp, revealExpired]);

  // Host transition: Drawing Turn Timeout
  useEffect(() => {
    if (isHost && phase === 'drawing' && turnEndTimestamp && turnExpired) {
      handleTurnTimeout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, phase, turnEndTimestamp, turnExpired]);

  // Host transition: Voting Timeout
  useEffect(() => {
    if (isHost && phase === 'voting' && voteEndTimestamp && voteExpired) {
      revealResults(votes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, phase, voteEndTimestamp, voteExpired]);

  // Message Handler Registration
  useEffect(() => {
    onRegisterMessageHandler((envelope: Envelope) => {
      const { type, payload, playerId: senderId } = envelope;

      if (type === 'fake-it-state-update') {
        if (!isHost) {
          const state = payload as GameState;
          setPhase(state.phase);
          setImposterId(state.imposterId);
          setTopic(state.topic);
          setDrawerIndex(state.drawerIndex);
          setDrawingRound(state.drawingRound);
          setLines(state.lines);
          setVotes(state.votes);
          setScores(state.scores);
          setRoundPoints(state.roundPoints);
          setRoleRevealEndTimestamp(state.roleRevealEndTimestamp);
          setTurnEndTimestamp(state.turnEndTimestamp);
          setVoteEndTimestamp(state.voteEndTimestamp);
        }
      } else if (type === 'debug-host-action') {
        if (isHost) {
          const payloadObj = payload as { action: string; [key: string]: unknown };
          handleDebugHostAction(payloadObj.action, payloadObj);
        }
      } else if (isHost) {
        if (type === 'draw-line') {
          const drawPayload = payload as { points: Point[] };
          handleClientDrawLine(senderId, drawPayload.points);
        } else if (type === 'submit-vote') {
          const votePayload = payload as { targetId: string };
          handleClientSubmitVote(senderId, votePayload.targetId);
        } else if (type === 'fake-it-request-state') {
          // A client missed the one-shot initial broadcast (or reconnected) and
          // is stuck on the loading screen — re-send the current full state.
          // Only once the game has actually started; nothing to sync otherwise.
          if (phase !== 'starting') broadcastState({});
        } else if (type === 'play-again') {
          // Play again handler
          setPhase('starting');
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, roster, drawerIndex, drawingRound, lines, votes, scores, roundPoints, phase, imposterId, topic, isTimerPaused]);

  // Confetti trigger on Leaderboard mounting
  useEffect(() => {
    if (phase === 'leaderboard') {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.4 }, colors: CONFETTI_COLORS });
    }
  }, [phase]);

  // Register debug actions with GameShell
  useEffect(() => {
    if (DEBUG_MODE && onRegisterDebugActions) {
      onRegisterDebugActions(getDebugActions(), phase);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isTimerPaused, lines.length, Object.keys(votes).length, drawerIndex, drawingRound]);

  // Repaint the page chrome per phase. The mockups run the easel/painting
  // screens dark and the vote / final tally light; see DARK_PHASES.
  useEffect(() => {
    onGameBgChange?.(
      DARK_PHASES.has(phase)
        ? 'bg-fakeit-dark text-white'
        : 'bg-fakeit-light text-fakeit-ink'
    );
  }, [phase, onGameBgChange]);

  // Is it my turn to draw?
  const isMyTurn = phase === 'drawing' && roster[drawerIndex]?.id === playerId;
  const isImposter = playerId === imposterId;


  return (
    <FakeItScreens
      phase={phase}
      isImposter={isImposter}
      topic={topic}
      revealSec={revealSec}
      drawingRound={drawingRound}
      drawerIndex={drawerIndex}
      roster={roster}
      playerId={playerId}
      imposterId={imposterId}
      getPlayerColor={getPlayerColor}
      turnSec={turnSec}
      turnMs={turnMs}
      voteSec={voteSec}
      lines={lines}
      isMyTurn={isMyTurn}
      handleDrawEnd={handleDrawEnd}
      myVote={myVote}
      handleVoteSubmit={handleVoteSubmit}
      votes={votes}
      scores={scores}
      roundPoints={roundPoints}
      isHost={isHost}
      handleNextRound={handleNextRound}
      setPhase={setPhase}
      playAgain={playAgain}
      onQuit={onQuit}
    />
  );
}
