import { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useCountdown } from '../../shared/hooks/useCountdown';
import type { Envelope } from '../../shared/types';
import type { GamePlayProps } from '../../shared/GameShell';
import type { FakeItPhase, GameState, Line, Topic, Point } from './types';
import { isFuzzyMatch } from './utils/fuzzyMatch';
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
  PAYOUT_CORRECT_VOTE_ESCAPED,
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
  guessEndTimestamp: number | null;
  usedTopicNames: string[];
}

const CONFETTI_COLORS = ['#f9749f', '#03d1b9', '#facc15'];

// Phases the mockups draw on a dark stage: the prompt reveal, the drawing
// easel, and the round payout. Lobby / vote / final tally are light.
const DARK_PHASES = new Set<FakeItPhase>(['starting', 'role-reveal', 'drawing', 'guessing', 'results']);

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
  const [guessEndTimestamp, setGuessEndTimestamp] = useState<number | null>(restored?.guessEndTimestamp ?? null);


  const [myVote, setMyVote] = useState<string | null>(null);

  // The host merges each incoming vote onto the running tally. Reading that
  // tally from `votes` meant reading it from the message handler's closure,
  // which is only refreshed on re-render — so two votes arriving in the same
  // tick both merged onto the same snapshot and the second silently dropped
  // the first. This ref is updated synchronously, so a burst accumulates.
  const votesRef = useRef<Record<string, string>>(restored?.votes ?? {});

  function applyVotes(next: Record<string, string>) {
    votesRef.current = next;
    setVotes(next);
  }



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
      guessEndTimestamp,
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
    guessEndTimestamp,
  ]);

  // Timers using useCountdown
  const { msRemaining: revealMs, expired: revealExpired } = useCountdown(roleRevealEndTimestamp);
  const { msRemaining: turnMs, expired: turnExpired } = useCountdown(turnEndTimestamp);
  const { msRemaining: voteMs, expired: voteExpired } = useCountdown(voteEndTimestamp);
  const { msRemaining: guessMs, expired: guessExpired } = useCountdown(guessEndTimestamp);

  const revealSec = Math.ceil(revealMs / 1000);
  const turnSec = Math.ceil(turnMs / 1000);
  const voteSec = Math.ceil(voteMs / 1000);
  const guessSec = Math.ceil(guessMs / 1000);

  // Get color for a player index
  function getPlayerColor(pId: string) {
    const pIndex = roster.findIndex((p) => p.id === pId);
    return pIndex >= 0 ? DRAWING_COLORS[pIndex % DRAWING_COLORS.length] : '#9ca3af';
  }

  // Helper to broadcast state from host
  const broadcastState = useCallback((fields: Partial<GameState>) => {
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
      guessEndTimestamp,
      ...fields,
    };
    sendMessage({
      type: 'fake-it-state-update',
      timestamp: Date.now(),
      payload: fullState,
    });
  }, [
    phase, imposterId, topic, drawerIndex, drawingRound, lines, votes, scores,
    roundPoints, roleRevealEndTimestamp, turnEndTimestamp, voteEndTimestamp,
    guessEndTimestamp, sendMessage
  ]);

  // Helper to advance the drawing turn
  const advanceTurn = useCallback((currentLines: Line[]) => {
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
  }, [drawerIndex, drawingRound, roster.length, broadcastState]);

  // Handle drawing turn timeout on host
  const handleTurnTimeout = useCallback(() => {
    advanceTurn(lines);
  }, [lines, advanceTurn]);

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

    const nextVotes = { ...votesRef.current, [senderId]: targetId };
    applyVotes(nextVotes);

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
  const revealResults = useCallback((finalVotes: Record<string, string>) => {
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

    const imposterCaught = votedOutIds.length === 1 && votedOutIds[0] === imposterId;

    if (maxVotes > 0 && imposterCaught) {
      // Imposter is caught: they get a chance to guess!
      const endTimestamp = Date.now() + 10000;
      setPhase('guessing');
      applyVotes(finalVotes);
      setVoteEndTimestamp(null);
      setGuessEndTimestamp(endTimestamp);

      broadcastState({
        phase: 'guessing',
        votes: finalVotes,
        voteEndTimestamp: null,
        guessEndTimestamp: endTimestamp,
      });
      return;
    }

    // Imposter escaped or nobody voted: go straight to results
    const newRoundPoints: Record<string, number> = {};
    roster.forEach((p) => {
      newRoundPoints[p.id] = 0;
    });

    if (maxVotes > 0) {
      // Imposter escaped the vote — the group convicted someone else. Still pay
      // a consolation to anyone who fingered the imposter correctly.
      Object.entries(finalVotes).forEach(([voterId, votedId]) => {
        if (votedId === imposterId) {
          newRoundPoints[voterId] = PAYOUT_CORRECT_VOTE_ESCAPED;
        }
      });
      // Set the imposter's payout last so a self-vote can't clobber it.
      newRoundPoints[imposterId] = PAYOUT_IMPOSTER_ESCAPED;
    }

    const nextScores = { ...scores };
    roster.forEach((p) => {
      nextScores[p.id] = (nextScores[p.id] || 0) + (newRoundPoints[p.id] || 0);
    });

    setPhase('results');
    applyVotes(finalVotes);
    setScores(nextScores);
    setRoundPoints(newRoundPoints);
    setVoteEndTimestamp(null);
    setGuessEndTimestamp(null);

    broadcastState({
      phase: 'results',
      votes: finalVotes,
      scores: nextScores,
      roundPoints: newRoundPoints,
      voteEndTimestamp: null,
      guessEndTimestamp: null,
    });
  }, [roster, imposterId, scores, broadcastState]);

  // Host: process the imposter's guess
  const handleImposterGuess = useCallback((guessText: string | null) => {
    const correct = guessText ? isFuzzyMatch(guessText, topic?.name || '') : false;
    const newRoundPoints: Record<string, number> = {};
    roster.forEach((p) => {
      newRoundPoints[p.id] = 0;
    });

    if (correct) {
      // Imposter was caught but guessed the topic and got away. The players who
      // caught them still earn the consolation for fingering the imposter.
      Object.entries(votes).forEach(([voterId, votedId]) => {
        if (votedId === imposterId) {
          newRoundPoints[voterId] = PAYOUT_CORRECT_VOTE_ESCAPED;
        }
      });
      // Set the imposter's payout last so a self-vote can't clobber it.
      newRoundPoints[imposterId] = PAYOUT_IMPOSTER_ESCAPED;
    } else {
      // Imposter failed! Artists win.
      // Everyone who voted for the imposter gets paid.
      Object.entries(votes).forEach(([voterId, votedId]) => {
        if (votedId === imposterId) {
          newRoundPoints[voterId] = PAYOUT_CORRECT_VOTE;
        }
      });
    }

    const nextScores = { ...scores };
    roster.forEach((p) => {
      nextScores[p.id] = (nextScores[p.id] || 0) + (newRoundPoints[p.id] || 0);
    });

    setPhase('results');
    setScores(nextScores);
    setRoundPoints(newRoundPoints);
    setGuessEndTimestamp(null);

    broadcastState({
      phase: 'results',
      scores: nextScores,
      roundPoints: newRoundPoints,
      guessEndTimestamp: null,
    });
  }, [topic, roster, imposterId, votes, scores, broadcastState]);

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
    applyVotes({});
    setMyVote(null); // host skips the client sync path, so clear its old vote here
    setRoundPoints({});
    setRoleRevealEndTimestamp(revealEnd);
    setTurnEndTimestamp(null);
    setVoteEndTimestamp(null);
    setGuessEndTimestamp(null);

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
      guessEndTimestamp: null,
    });
  }

  // Host: End the game. Every other phase change is broadcast; this one used to
  // be a bare setPhase, which moved the host to the final tally and left every
  // player sitting on the round payout screen.
  function endGame() {
    setPhase('leaderboard');
    broadcastState({ phase: 'leaderboard' });
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
    if (isHost && phase === 'starting') {
      const activePlayers = roster;
      if (activePlayers.length === 0) return;

      const timer = setTimeout(() => {
        const { topic: randomTopic, usedNames } = pickTopic(usedTopicNames);
        const randomImposter = activePlayers[Math.floor(Math.random() * activePlayers.length)];

        const initialScores = { ...scores };
        activePlayers.forEach((p) => {
          if (initialScores[p.id] === undefined) {
            initialScores[p.id] = 0;
          }
        });

        const revealEnd = Date.now() + ROLE_REVEAL_DURATION_MS;

        setPhase('role-reveal');
        setImposterId(randomImposter.id);
        setTopic(randomTopic);
        setUsedTopicNames(usedNames);
        setDrawerIndex(0);
        setDrawingRound(1);
        setLines([]);
        applyVotes({});
        setMyVote(null); // host manages its own state, so reset its vote here too
        setScores(initialScores);
        setRoundPoints({});
        setRoleRevealEndTimestamp(revealEnd);
        setTurnEndTimestamp(null);
        setVoteEndTimestamp(null);
        setGuessEndTimestamp(null);

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
          guessEndTimestamp: null,
        };

        sendMessage({
          type: 'fake-it-state-update',
          timestamp: Date.now(),
          payload: newState,
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isHost, freshStart, roster, scores, sendMessage, usedTopicNames, phase]);

  // Dev-only host controls (hoisted helpers below are passed in as context).
  const { isTimerPaused, handleDebugHostAction, getDebugActions } = useFakeItDebug({
    isHost, playerId, sendMessage, phase, roster, drawerIndex, lines, votes,
    roleRevealEndTimestamp, turnEndTimestamp, voteEndTimestamp,
    setRoleRevealEndTimestamp, setTurnEndTimestamp, setVoteEndTimestamp,
    setPhase, setLines, setVotes: applyVotes, broadcastState, advanceTurn, revealResults, getPlayerColor,
  });

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
      const timer = setTimeout(() => {
        setPhase('drawing');
        setRoleRevealEndTimestamp(null);
        setTurnEndTimestamp(endTimestamp);

        broadcastState({
          phase: 'drawing',
          roleRevealEndTimestamp: null,
          turnEndTimestamp: endTimestamp,
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isHost, phase, roleRevealEndTimestamp, revealExpired, broadcastState]);

  // Host transition: Drawing Turn Timeout
  useEffect(() => {
    if (isHost && phase === 'drawing' && turnEndTimestamp && turnExpired) {
      const timer = setTimeout(() => {
        handleTurnTimeout();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isHost, phase, turnEndTimestamp, turnExpired, handleTurnTimeout]);

  // Host transition: Voting Timeout
  useEffect(() => {
    if (isHost && phase === 'voting' && voteEndTimestamp && voteExpired) {
      // The ref, not `votes` — a vote landing in the same tick as the timer
      // expiring would otherwise be left out of the tally.
      revealResults(votesRef.current);
    }
  }, [isHost, phase, voteEndTimestamp, voteExpired, revealResults]);

  // Host transition: Guessing Timeout
  useEffect(() => {
    if (isHost && phase === 'guessing' && guessEndTimestamp && guessExpired) {
      const timer = setTimeout(() => {
        handleImposterGuess(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isHost, phase, guessEndTimestamp, guessExpired, handleImposterGuess]);

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
          applyVotes(state.votes);
          setScores(state.scores);
          setRoundPoints(state.roundPoints);
          setRoleRevealEndTimestamp(state.roleRevealEndTimestamp);
          setTurnEndTimestamp(state.turnEndTimestamp);
          setVoteEndTimestamp(state.voteEndTimestamp);
          setGuessEndTimestamp(state.guessEndTimestamp);

          // Keep my own vote in sync with the authoritative tally instead of
          // blanking it on every broadcast — otherwise the moment the host
          // echoes my vote back, my UI drops it and asks me to vote again.
          // A new round clears the tally, so this also resets it correctly.
          setMyVote(state.votes[playerId] ?? null);
        }
      } else if (type === 'debug-host-action') {
        if (isHost) {
          handleDebugHostAction((payload as { action: string }).action);
        }
      } else if (isHost) {
        if (type === 'submit-vote') {
          if (senderId) {
            // handleVoteSubmit sends { targetId }, not { choice }.
            handleClientSubmitVote(senderId, (payload as { targetId: string }).targetId);
          }
        } else if (type === 'draw-line') {
          if (senderId) {
            handleClientDrawLine(senderId, (payload as { points: Point[] }).points);
          }
        } else if (type === 'submit-guess') {
          if (senderId) {
            handleImposterGuess((payload as { guess: string }).guess);
          }
        } else if (type === 'fake-it-request-state') {
          // Only once the game has actually started; nothing to sync otherwise.
          if (phase !== 'starting') broadcastState({});
        } else if (type === 'play-again') {
          // Play again handler
          setPhase('starting');
        }
      }
    });
  });

  // Confetti trigger on Leaderboard mounting
  useEffect(() => {
    if (phase === 'leaderboard') {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.4 }, colors: CONFETTI_COLORS });
    }
  }, [phase]);

  // Register debug actions with GameShell
  const linesCount = lines.length;
  const votesCount = Object.keys(votes).length;
  useEffect(() => {
    if (DEBUG_MODE && onRegisterDebugActions) {
      onRegisterDebugActions(getDebugActions(), phase);
    }
  }, [phase, isTimerPaused, linesCount, votesCount, drawerIndex, drawingRound, getDebugActions, onRegisterDebugActions]);

  // Repaint the page chrome per phase. The mockups run the easel/painting
  // screens dark and the vote / final tally light; see DARK_PHASES.
  useEffect(() => {
    onGameBgChange?.(
      DARK_PHASES.has(phase)
        ? 'bg-fakeit-dark text-white'
        : 'bg-fakeit-light text-fakeit-ink'
    );
  }, [phase, onGameBgChange]);

  // Client: Submit imposter guess
  function handleGuessSubmit(guessText: string) {
    sendMessage({
      type: 'submit-guess',
      playerId,
      timestamp: Date.now(),
      payload: { guess: guessText },
    });
  }

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
      endGame={endGame}
      playAgain={playAgain}
      onQuit={onQuit}
      guessSec={guessSec}
      handleGuessSubmit={handleGuessSubmit}
    />
  );
}
