import { useEffect, useRef, useState } from 'react';
import { useCountdown } from '../../shared/hooks/useCountdown';
import type { Envelope } from '../../shared/types';
import type { GamePlayProps } from '../../shared/GameShell';
import type { JokeFactoryPhase, GameState, Prompt, PromptMatchup, Round3State } from './types';
import { useJokeFactoryHost } from './useJokeFactoryHost';
import JokeFactoryViews from './components/JokeFactoryViews';
import { WRITING_DURATION_MS } from './constants';
import { audioManager } from '../../shared/utils/audio';

interface JokeFactorySnapshot {
  gamePhase: JokeFactoryPhase;
  round: number;
  playerPrompts: Record<string, Prompt[]>;
  playerAnswers: Record<string, Record<string, string>>;
  matchups: PromptMatchup[];
  currentMatchIndex: number;
  round3Data: Round3State | null;
  scores: Record<string, number>;
  roundPoints: Record<string, number>;
  writingEndTimestamp: number | null;
  votingEndTimestamp: number | null;
  resultsEndTimestamp: number | null;
}

export default function JokeFactoryGame({
  code,
  playerId,
  isHost,
  roster,
  isConnected,
  sendMessage,
  freshStart,
  onRegisterMessageHandler,
  onQuit,
}: GamePlayProps) {
  const restored = freshStart
    ? null
    : (JSON.parse(sessionStorage.getItem(`joke-factory-snap-${code}`) || 'null') as JokeFactorySnapshot | null);

  const [phase, setPhase] = useState<JokeFactoryPhase>(restored?.gamePhase ?? 'starting');
  const [round, setRound] = useState<number>(restored?.round ?? 1);
  const [playerPrompts, setPlayerPrompts] = useState<Record<string, Prompt[]>>(restored?.playerPrompts ?? {});
  const [playerAnswers, setPlayerAnswers] = useState<Record<string, Record<string, string>>>(restored?.playerAnswers ?? {});
  const [matchups, setMatchups] = useState<PromptMatchup[]>(restored?.matchups ?? []);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(restored?.currentMatchIndex ?? 0);
  const [round3Data, setRound3Data] = useState<Round3State | null>(restored?.round3Data ?? null);
  const [scores, setScores] = useState<Record<string, number>>(restored?.scores ?? {});
  const [roundPoints, setRoundPoints] = useState<Record<string, number>>(restored?.roundPoints ?? {});

  const [revealEndTimestamp, setRevealEndTimestamp] = useState<number | null>(null);
  const [writingEndTimestamp, setWritingEndTimestamp] = useState<number | null>(restored?.writingEndTimestamp ?? null);
  const [votingEndTimestamp, setVotingEndTimestamp] = useState<number | null>(restored?.votingEndTimestamp ?? null);
  const [resultsEndTimestamp, setResultsEndTimestamp] = useState<number | null>(restored?.resultsEndTimestamp ?? null);

  const [answersSubmitted, setAnswersSubmitted] = useState<boolean>(false);

  // Refs mirror state so message handlers always read latest values
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const answersRef = useRef(playerAnswers);
  useEffect(() => { answersRef.current = playerAnswers; }, [playerAnswers]);

  // Timers using useCountdown
  const { msRemaining: revealMs, expired: revealExpired } = useCountdown(revealEndTimestamp);
  const { msRemaining: writingMs, expired: writingExpired } = useCountdown(writingEndTimestamp);
  const { msRemaining: votingMs, expired: votingExpired } = useCountdown(votingEndTimestamp);

  const writingSec = Math.ceil(writingMs / 1000);

  // Host hook helper
  const { startRound } = useJokeFactoryHost(roster);

  // Helper to broadcast state from host
  function broadcastState(fields: Partial<GameState>) {
    const fullState: GameState = {
      phase,
      round,
      playerPrompts,
      playerAnswers,
      matchups,
      currentMatchIndex,
      round3Data,
      scores,
      roundPoints,
      writingEndTimestamp,
      votingEndTimestamp,
      resultsEndTimestamp,
      ...fields,
    };
    sendMessage({
      type: 'joke-factory-state-update',
      timestamp: Date.now(),
      payload: fullState,
    });
  }

  // Save state snapshots on change
  useEffect(() => {
    const snapshot: JokeFactorySnapshot = {
      gamePhase: phase,
      round,
      playerPrompts,
      playerAnswers,
      matchups,
      currentMatchIndex,
      round3Data,
      scores,
      roundPoints,
      writingEndTimestamp,
      votingEndTimestamp,
      resultsEndTimestamp,
    };
    sessionStorage.setItem(`joke-factory-snap-${code}`, JSON.stringify(snapshot));
  }, [code, phase, round, playerPrompts, playerAnswers, matchups, currentMatchIndex, round3Data, scores, roundPoints, writingEndTimestamp, votingEndTimestamp, resultsEndTimestamp]);

  // Host: Process client answers submission
  function handleClientSubmitAnswers(senderId: string, answers: Record<string, string>) {
    if (phaseRef.current !== 'writing') return;

    const nextAnswers = { ...answersRef.current, [senderId]: answers };
    setPlayerAnswers(nextAnswers);

    const activePlayers = roster.length;
    const submittedCount = Object.keys(nextAnswers).length;

    if (submittedCount >= activePlayers) {
      advanceToVoting(nextAnswers);
    } else {
      broadcastState({ playerAnswers: nextAnswers });
    }
  }

  function advanceToVoting(finalAnswers: Record<string, Record<string, string>>) {
    // Build matchups for Voting phase
    // (This matches details of the next issue)
    setPhase('voting');
    setWritingEndTimestamp(null);
    broadcastState({
      phase: 'voting',
      playerAnswers: finalAnswers,
      writingEndTimestamp: null,
    });
  }

  function autoSubmitAnswers() {
    const finalAnswers = { ...answersRef.current };
    roster.forEach((p) => {
      if (!finalAnswers[p.id]) {
        finalAnswers[p.id] = {};
      }
      const prompts = playerPrompts[p.id] || [];
      prompts.forEach((prompt) => {
        if (!finalAnswers[p.id][prompt.id]) {
          finalAnswers[p.id][prompt.id] = 'Missed the deadline!';
        }
      });
    });

    setPlayerAnswers(finalAnswers);
    advanceToVoting(finalAnswers);
  }

  // Client: Submit answers to host
  function handleSubmitAnswers(answers: Record<string, string>) {
    setAnswersSubmitted(true);
    audioManager.playClick();
    sendMessage({
      type: 'submit-answers',
      playerId,
      timestamp: Date.now(),
      payload: { answers },
    });
  }

  // Initialize Game (Host only)
  useEffect(() => {
    if (isHost && (phase === 'starting' || freshStart)) {
      if (roster.length === 0) return;

      const initialScores: Record<string, number> = {};
      roster.forEach((p) => {
        initialScores[p.id] = 0;
      });

      const setup = startRound(1);
      const revealEnd = Date.now() + 5000;

      setPhase('prompt-reveal');
      setRound(1);
      setPlayerPrompts(setup.playerPrompts);
      setMatchups(setup.matchups);
      setRound3Data(setup.round3Data);
      setScores(initialScores);
      setRoundPoints({});
      setRevealEndTimestamp(revealEnd);

      const newState: GameState = {
        phase: 'prompt-reveal',
        round: 1,
        playerPrompts: setup.playerPrompts,
        playerAnswers: {},
        matchups: setup.matchups,
        currentMatchIndex: 0,
        round3Data: setup.round3Data,
        scores: initialScores,
        roundPoints: {},
        writingEndTimestamp: null,
        votingEndTimestamp: null,
        resultsEndTimestamp: null,
      };

      sendMessage({
        type: 'joke-factory-state-update',
        timestamp: Date.now(),
        payload: newState,
      });
    }
  }, [isHost, freshStart, roster.length]);

  // Host transition: Reveal -> Writing
  useEffect(() => {
    if (isHost && phase === 'prompt-reveal' && revealEndTimestamp && revealExpired) {
      const endTimestamp = Date.now() + WRITING_DURATION_MS;
      setPhase('writing');
      setRevealEndTimestamp(null);
      setWritingEndTimestamp(endTimestamp);

      broadcastState({
        phase: 'writing',
        writingEndTimestamp: endTimestamp,
      });
    }
  }, [isHost, phase, revealEndTimestamp, revealExpired]);

  // Host transition: Writing Timeout
  useEffect(() => {
    if (isHost && phase === 'writing' && writingEndTimestamp && writingExpired) {
      autoSubmitAnswers();
    }
  }, [isHost, phase, writingEndTimestamp, writingExpired]);

  // Message Handler Registration
  useEffect(() => {
    onRegisterMessageHandler((envelope: Envelope) => {
      const { type, payload, playerId: senderId } = envelope;

      if (type === 'joke-factory-state-update') {
        if (!isHost) {
          const state = payload as GameState;
          setPhase(state.phase);
          setRound(state.round);
          setPlayerPrompts(state.playerPrompts);
          setPlayerAnswers(state.playerAnswers);
          setMatchups(state.matchups);
          setCurrentMatchIndex(state.currentMatchIndex);
          setRound3Data(state.round3Data);
          setScores(state.scores);
          setRoundPoints(state.roundPoints);
          setWritingEndTimestamp(state.writingEndTimestamp);
          setVotingEndTimestamp(state.votingEndTimestamp);
          setResultsEndTimestamp(state.resultsEndTimestamp);
        }
      } else if (isHost) {
        if (type === 'submit-answers') {
          if (senderId) {
            const data = payload as { answers: Record<string, string> };
            handleClientSubmitAnswers(senderId, data.answers);
          }
        }
      }
    });
  }, [isHost, roster, playerPrompts]);

  const prompts = playerPrompts[playerId] || [];
  const submissionCount = Object.keys(playerAnswers).length;

  return (
    <JokeFactoryViews
      phase={phase}
      round={round}
      roster={roster}
      playerId={playerId}
      isDisplay={false}
      isHost={isHost}
      prompts={prompts}
      writingSec={writingSec}
      answersSubmitted={answersSubmitted}
      onSubmitAnswers={handleSubmitAnswers}
      submissionCount={submissionCount}
      onQuit={onQuit}
    />
  );
}
