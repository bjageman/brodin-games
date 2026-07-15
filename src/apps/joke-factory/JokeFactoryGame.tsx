import { useEffect, useRef, useState, useCallback } from 'react';
import { useCountdown } from '../../shared/hooks/useCountdown';
import type { Envelope } from '../../shared/types';
import type { GamePlayProps } from '../../shared/GameShell';
import type { JokeFactoryPhase, GameState, Prompt, PromptMatchup, Round3State } from './types';
import { useJokeFactoryHost } from './useJokeFactoryHost';
import JokeFactoryViews from './components/JokeFactoryViews';
import { WRITING_DURATION_MS, VOTING_DURATION_MS, RESULTS_DURATION_MS } from './constants';
import { audioManager } from '../../shared/utils/audio';
import { DEBUG_MODE } from '../../shared/constants';
import { useJokeFactoryDebug } from './useJokeFactoryDebug';

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
  sendMessage,
  isDisplay,
  freshStart,
  onRegisterMessageHandler,
  onQuit,
  onRegisterDebugActions,
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
  const [myVote, setMyVote] = useState<string | null>(null);

  // Refs mirror state so message handlers always read latest values
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const roundRef = useRef(round);
  useEffect(() => { roundRef.current = round; }, [round]);
  const promptsRef = useRef(playerPrompts);
  useEffect(() => { promptsRef.current = playerPrompts; }, [playerPrompts]);
  const answersRef = useRef(playerAnswers);
  useEffect(() => { answersRef.current = playerAnswers; }, [playerAnswers]);
  const matchupsRef = useRef(matchups);
  useEffect(() => { matchupsRef.current = matchups; }, [matchups]);
  const currentMatchIndexRef = useRef(currentMatchIndex);
  useEffect(() => { currentMatchIndexRef.current = currentMatchIndex; }, [currentMatchIndex]);
  const scoresRef = useRef(scores);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  const roundPointsRef = useRef(roundPoints);
  useEffect(() => { roundPointsRef.current = roundPoints; }, [roundPoints]);

  // Timers using useCountdown
  const { expired: revealExpired } = useCountdown(revealEndTimestamp);
  const { msRemaining: writingMs, expired: writingExpired } = useCountdown(writingEndTimestamp);
  const { msRemaining: votingMs, expired: votingExpired } = useCountdown(votingEndTimestamp);
  const { msRemaining: resultsMs, expired: resultsExpired } = useCountdown(resultsEndTimestamp);

  const writingSec = Math.ceil(writingMs / 1000);
  const votingSec = Math.ceil(votingMs / 1000);
  const resultsSec = Math.ceil(resultsMs / 1000);

  // Host hook helper
  const { startRound } = useJokeFactoryHost(roster);

  // Helper to broadcast state from host
  const broadcastState = useCallback((fields: Partial<GameState>) => {
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
  }, [
    phase, round, playerPrompts, playerAnswers, matchups, currentMatchIndex,
    round3Data, scores, roundPoints, writingEndTimestamp, votingEndTimestamp,
    resultsEndTimestamp, sendMessage
  ]);
  const revealMatchupResults = useCallback((latestMatchups: PromptMatchup[]) => {
    const currentMatch = latestMatchups[currentMatchIndexRef.current];

    const leftVotes = Object.values(currentMatch.votes).filter((v) => v === 'left').length;
    const rightVotes = Object.values(currentMatch.votes).filter((v) => v === 'right').length;
    const totalVotes = leftVotes + rightVotes;

    const ptsPerVote = 100;
    const bonusPts = 200;

    let leftPoints = leftVotes * ptsPerVote;
    let rightPoints = rightVotes * ptsPerVote;

    if (totalVotes > 0) {
      if (leftVotes === totalVotes) leftPoints += bonusPts;
      if (rightVotes === totalVotes) rightPoints += bonusPts;
    }

    const nextRoundPoints = { ...roundPointsRef.current };
    nextRoundPoints[currentMatch.leftPlayerId] = (nextRoundPoints[currentMatch.leftPlayerId] || 0) + leftPoints;
    nextRoundPoints[currentMatch.rightPlayerId] = (nextRoundPoints[currentMatch.rightPlayerId] || 0) + rightPoints;

    const nextScores = { ...scoresRef.current };
    nextScores[currentMatch.leftPlayerId] = (nextScores[currentMatch.leftPlayerId] || 0) + leftPoints;
    nextScores[currentMatch.rightPlayerId] = (nextScores[currentMatch.rightPlayerId] || 0) + rightPoints;

    const endTimestamp = Date.now() + RESULTS_DURATION_MS;

    setPhase('results');
    setVotingEndTimestamp(null);
    setResultsEndTimestamp(endTimestamp);
    setRoundPoints(nextRoundPoints);
    setScores(nextScores);

    broadcastState({
      phase: 'results',
      votingEndTimestamp: null,
      resultsEndTimestamp: endTimestamp,
      roundPoints: nextRoundPoints,
      scores: nextScores,
      matchups: latestMatchups,
    });
  }, [broadcastState]);

  const revealRound3Results = useCallback((latestR3Data: Round3State) => {
    const totalVotes = Object.keys(latestR3Data.votes).length;

    const nextRoundPoints = { ...roundPointsRef.current };
    const nextScores = { ...scoresRef.current };

    roster.forEach((p) => {
      const vCount = Object.values(latestR3Data.votes).filter((v) => v === p.id).length;

      const ptsPerVote = 200; // doubled
      const bonusPts = 400; // doubled

      const isQuiplash = totalVotes > 0 && vCount === totalVotes;
      const points = vCount * ptsPerVote + (isQuiplash ? bonusPts : 0);

      nextRoundPoints[p.id] = (nextRoundPoints[p.id] || 0) + points;
      nextScores[p.id] = (nextScores[p.id] || 0) + points;
    });

    const endTimestamp = Date.now() + RESULTS_DURATION_MS;

    setPhase('results');
    setVotingEndTimestamp(null);
    setResultsEndTimestamp(endTimestamp);
    setRoundPoints(nextRoundPoints);
    setScores(nextScores);

    broadcastState({
      phase: 'results',
      votingEndTimestamp: null,
      resultsEndTimestamp: endTimestamp,
      roundPoints: nextRoundPoints,
      scores: nextScores,
      round3Data: latestR3Data,
    });
  }, [roster, broadcastState]);

  function simulateAnswers() {
    const finalAnswers = { ...answersRef.current };
    roster.forEach((p) => {
      if (p.id !== playerId) {
        const prompts = promptsRef.current[p.id] || [];
        const answers: Record<string, string> = {};
        prompts.forEach((pr, idx) => {
          answers[pr.id] = `Funny joke ${idx + 1} from ${p.name}!`;
        });
        finalAnswers[p.id] = answers;
      }
    });

    setPlayerAnswers(finalAnswers);

    const activePlayers = roster.length;
    const submittedCount = Object.keys(finalAnswers).length;

    if (submittedCount >= activePlayers) {
      advanceToVoting(finalAnswers);
    } else {
      broadcastState({ playerAnswers: finalAnswers });
    }
  }

  function simulateVotes() {
    if (roundRef.current === 3) {
      if (!round3Data) return;
      const nextVotes = { ...round3Data.votes };
      roster.forEach((p) => {
        if (p.id !== playerId) {
          const options = roster.filter((item) => item.id !== p.id);
          if (options.length > 0) {
            const pick = options[Math.floor(Math.random() * options.length)].id;
            nextVotes[p.id] = pick;
          }
        }
      });
      const nextR3Data = { ...round3Data, votes: nextVotes };
      setRound3Data(nextR3Data);

      const voterCount = Object.keys(nextVotes).length;
      const expectedVotes = roster.length;

      if (voterCount >= expectedVotes) {
        revealRound3Results(nextR3Data);
      } else {
        broadcastState({ round3Data: nextR3Data });
      }
    } else {
      const currentMatch = matchupsRef.current[currentMatchIndexRef.current];
      if (!currentMatch) return;
      const nextVotes = { ...currentMatch.votes };
      roster.forEach((p) => {
        if (p.id !== currentMatch.leftPlayerId && p.id !== currentMatch.rightPlayerId && p.id !== playerId) {
          const pick = Math.random() > 0.5 ? 'left' : 'right';
          nextVotes[p.id] = pick;
        }
      });
      const updatedMatchup = { ...currentMatch, votes: nextVotes };
      const nextMatchups = [...matchupsRef.current];
      nextMatchups[currentMatchIndexRef.current] = updatedMatchup;
      setMatchups(nextMatchups);

      const expectedVotes = roster.length - 2;
      const voterCount = Object.keys(nextVotes).length;

      if (voterCount >= expectedVotes) {
        revealMatchupResults(nextMatchups);
      } else {
        broadcastState({ matchups: nextMatchups });
      }
    }
  }

  function skipMatchup() {
    if (roundRef.current === 3) {
      if (round3Data) revealRound3Results(round3Data);
    } else {
      revealMatchupResults(matchupsRef.current);
    }
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

  const advanceToVoting = useCallback((finalAnswers: Record<string, Record<string, string>>) => {
    if (roundRef.current === 3) {
      // Round 3: Multi-answer Vote
      const answers: Record<string, string> = {};
      roster.forEach((p) => {
        const pPrompts = promptsRef.current[p.id] || [];
        const prompt = pPrompts[0];
        if (prompt) {
          answers[p.id] = finalAnswers[p.id]?.[prompt.id] || 'Missed the deadline!';
        }
      });

      const singlePrompt = promptsRef.current[roster[0].id][0];
      const r3State: Round3State = {
        prompt: singlePrompt,
        answers,
        votes: {},
      };

      const endTimestamp = Date.now() + VOTING_DURATION_MS;

      setPhase('voting');
      setWritingEndTimestamp(null);
      setRound3Data(r3State);
      setVotingEndTimestamp(endTimestamp);

      broadcastState({
        phase: 'voting',
        playerAnswers: finalAnswers,
        round3Data: r3State,
        writingEndTimestamp: null,
        votingEndTimestamp: endTimestamp,
      });
      return;
    }

    // Rounds 1 & 2: Pairwise Matchups
    const promptMap = new Map<string, Prompt>();
    Object.values(promptsRef.current).forEach((list) => {
      list.forEach((p) => promptMap.set(p.id, p));
    });
    const uniquePrompts = Array.from(promptMap.values());

    const newMatchups: PromptMatchup[] = [];
    uniquePrompts.forEach((prompt) => {
      const authors: string[] = [];
      Object.entries(finalAnswers).forEach(([pid, ansMap]) => {
        if (ansMap[prompt.id] !== undefined) {
          authors.push(pid);
        }
      });
      const leftPlayerId = authors[0] || roster[0]?.id;
      const rightPlayerId = authors[1] || roster[1]?.id;

      const leftAnswer = finalAnswers[leftPlayerId]?.[prompt.id] || 'Missed the deadline!';
      const rightAnswer = finalAnswers[rightPlayerId]?.[prompt.id] || 'Missed the deadline!';

      newMatchups.push({
        prompt,
        leftPlayerId,
        rightPlayerId,
        leftAnswer,
        rightAnswer,
        votes: {},
      });
    });

    const shuffledMatchups = [...newMatchups].sort(() => Math.random() - 0.5);
    const endTimestamp = Date.now() + VOTING_DURATION_MS;

    setPhase('voting');
    setWritingEndTimestamp(null);
    setMatchups(shuffledMatchups);
    setCurrentMatchIndex(0);
    setVotingEndTimestamp(endTimestamp);

    broadcastState({
      phase: 'voting',
      playerAnswers: finalAnswers,
      matchups: shuffledMatchups,
      currentMatchIndex: 0,
      writingEndTimestamp: null,
      votingEndTimestamp: endTimestamp,
    });
  }, [roster, broadcastState]);

  const autoSubmitAnswers = useCallback(() => {
    const finalAnswers = { ...answersRef.current };
    roster.forEach((p) => {
      if (!finalAnswers[p.id]) {
        finalAnswers[p.id] = {};
      }
      const prompts = promptsRef.current[p.id] || [];
      prompts.forEach((prompt) => {
        if (!finalAnswers[p.id][prompt.id]) {
          finalAnswers[p.id][prompt.id] = 'Missed the deadline!';
        }
      });
    });

    setPlayerAnswers(finalAnswers);
    advanceToVoting(finalAnswers);
  }, [roster, advanceToVoting]);

  // Host: Process client vote submission
  const handleClientSubmitVote = useCallback((senderId: string, choice: string) => {
    if (phaseRef.current !== 'voting') return;

    if (roundRef.current === 3) {
      if (!round3Data) return;
      if (senderId === choice) return; // Self vote block

      const nextR3Data = { ...round3Data };
      nextR3Data.votes = { ...nextR3Data.votes, [senderId]: choice };
      setRound3Data(nextR3Data);

      const activePlayers = roster.length;
      const eligibleVoters = activePlayers;
      const votesReceived = Object.keys(nextR3Data.votes).length;

      if (votesReceived >= eligibleVoters) {
        revealRound3Results(nextR3Data);
      } else {
        broadcastState({ round3Data: nextR3Data });
      }
      return;
    }

    const nextMatchups = [...matchupsRef.current];
    const currentMatch = { ...nextMatchups[currentMatchIndexRef.current] };

    // Authors cannot vote
    if (senderId === currentMatch.leftPlayerId || senderId === currentMatch.rightPlayerId) return;

    currentMatch.votes = { ...currentMatch.votes, [senderId]: choice as 'left' | 'right' };
    nextMatchups[currentMatchIndexRef.current] = currentMatch;
    setMatchups(nextMatchups);

    const activePlayers = roster.length;
    const eligibleVoters = activePlayers - 2;
    const votesReceived = Object.keys(currentMatch.votes).length;

    if (votesReceived >= eligibleVoters) {
      revealMatchupResults(nextMatchups);
    } else {
      broadcastState({ matchups: nextMatchups });
    }
  }, [roster, round3Data, broadcastState, revealRound3Results, revealMatchupResults]);



  const handleResultsTimeout = useCallback(() => {
    if (roundRef.current < 3) {
      if (currentMatchIndexRef.current + 1 < matchupsRef.current.length) {
        const nextIndex = currentMatchIndexRef.current + 1;
        const endTimestamp = Date.now() + VOTING_DURATION_MS;

        setMyVote(null);
        setPhase('voting');
        setCurrentMatchIndex(nextIndex);
        setResultsEndTimestamp(null);
        setVotingEndTimestamp(endTimestamp);

        broadcastState({
          phase: 'voting',
          currentMatchIndex: nextIndex,
          resultsEndTimestamp: null,
          votingEndTimestamp: endTimestamp,
        });
      } else {
        setPhase('leaderboard');
        setResultsEndTimestamp(null);
        broadcastState({
          phase: 'leaderboard',
          resultsEndTimestamp: null,
        });
      }
    } else {
      setPhase('leaderboard');
      setResultsEndTimestamp(null);
      broadcastState({
        phase: 'leaderboard',
        resultsEndTimestamp: null,
      });
    }
  }, [broadcastState]);

  // Host: Next Round Activation
  function handleNextRound() {
    const nextRound = roundRef.current + 1;
    const setup = startRound(nextRound);
    const endTimestamp = Date.now() + WRITING_DURATION_MS;

    setPhase('writing');
    setRound(nextRound);
    setPlayerPrompts(setup.playerPrompts);
    setPlayerAnswers({});
    setMatchups(setup.matchups);
    setCurrentMatchIndex(0);
    setRound3Data(setup.round3Data);
    setRoundPoints({});
    setAnswersSubmitted(false);
    setMyVote(null);
    setWritingEndTimestamp(endTimestamp);

    broadcastState({
      phase: 'writing',
      round: nextRound,
      playerPrompts: setup.playerPrompts,
      playerAnswers: {},
      matchups: setup.matchups,
      currentMatchIndex: 0,
      round3Data: setup.round3Data,
      roundPoints: {},
      writingEndTimestamp: endTimestamp,
      votingEndTimestamp: null,
      resultsEndTimestamp: null,
    });
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

  // Client: Submit vote choice to host
  function handleSubmitVote(choice: string) {
    setMyVote(choice);
    audioManager.playClick();
    sendMessage({
      type: 'submit-vote',
      playerId,
      timestamp: Date.now(),
      payload: { choice },
    });
  }

  // Initialize Game (Host only)
  useEffect(() => {
    if (isHost && phase === 'starting') {
      if (roster.length === 0) return;

      const timer = setTimeout(() => {
        const initialScores: Record<string, number> = {};
        roster.forEach((p) => {
          initialScores[p.id] = 0;
        });

        const setup = startRound(1);
        const endTimestamp = Date.now() + WRITING_DURATION_MS;

        setPhase('writing');
        setRound(1);
        setPlayerPrompts(setup.playerPrompts);
        setMatchups(setup.matchups);
        setRound3Data(setup.round3Data);
        setScores(initialScores);
        setRoundPoints({});
        setWritingEndTimestamp(endTimestamp);

        const newState: GameState = {
          phase: 'writing',
          round: 1,
          playerPrompts: setup.playerPrompts,
          playerAnswers: {},
          matchups: setup.matchups,
          currentMatchIndex: 0,
          round3Data: setup.round3Data,
          scores: initialScores,
          roundPoints: {},
          writingEndTimestamp: endTimestamp,
          votingEndTimestamp: null,
          resultsEndTimestamp: null,
        };

        sendMessage({
          type: 'joke-factory-state-update',
          timestamp: Date.now(),
          payload: newState,
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isHost, freshStart, roster, sendMessage, startRound, phase]);

  // Host transition: Reveal -> Writing
  useEffect(() => {
    if (isHost && phase === 'prompt-reveal' && revealEndTimestamp && revealExpired) {
      const endTimestamp = Date.now() + WRITING_DURATION_MS;
      const timer = setTimeout(() => {
        setPhase('writing');
        setRevealEndTimestamp(null);
        setWritingEndTimestamp(endTimestamp);

        broadcastState({
          phase: 'writing',
          writingEndTimestamp: endTimestamp,
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isHost, phase, revealEndTimestamp, revealExpired, broadcastState]);

  // Host transition: Writing Timeout
  useEffect(() => {
    if (isHost && phase === 'writing' && writingEndTimestamp && writingExpired) {
      const timer = setTimeout(() => {
        autoSubmitAnswers();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isHost, phase, writingEndTimestamp, writingExpired, autoSubmitAnswers]);

  // Host transition: Voting Timeout
  useEffect(() => {
    if (isHost && phase === 'voting' && votingEndTimestamp && votingExpired) {
      const timer = setTimeout(() => {
        if (roundRef.current < 3) {
          revealMatchupResults(matchupsRef.current);
        } else {
          if (round3Data) revealRound3Results(round3Data);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isHost, phase, votingEndTimestamp, votingExpired, round3Data, revealMatchupResults, revealRound3Results]);

  // Host transition: Results Timeout
  useEffect(() => {
    if (isHost && phase === 'results' && resultsEndTimestamp && resultsExpired) {
      const timer = setTimeout(() => {
        handleResultsTimeout();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isHost, phase, resultsEndTimestamp, resultsExpired, handleResultsTimeout]);

  const { isTimerPaused, handleDebugHostAction, getDebugActions } = useJokeFactoryDebug({
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
    skipWriting: autoSubmitAnswers,
    simulateVotes,
    skipMatchup,
    skipResults: handleResultsTimeout,
    nextRound: handleNextRound,
    endGameAction: onQuit,
    broadcastState,
  });

  // Register debug actions with GameShell
  useEffect(() => {
    if (DEBUG_MODE && onRegisterDebugActions) {
      onRegisterDebugActions(getDebugActions(), phase);
    }
  }, [phase, isTimerPaused, playerPrompts, matchups, currentMatchIndex, round3Data, round, onRegisterDebugActions, getDebugActions]);

  // Client recovery: if we're still on the loading screen ('starting') after
  // mounting, we likely missed the host's one-shot initial state broadcast
  // (a race: the broadcast can arrive before our message handler registers).
  // Poll the host for the current state until it lands or we give up.
  useEffect(() => {
    if (isHost || phase !== 'starting') return;
    let attempts = 0;
    const trySend = () => {
      sendMessage({ type: 'joke-factory-request-state', playerId, timestamp: Date.now(), payload: {} });
      attempts++;
      if (attempts >= 10) clearInterval(interval);
    };
    trySend();
    const interval = setInterval(trySend, 1000);
    return () => clearInterval(interval);
  }, [isHost, phase, playerId, sendMessage]);

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

          setMyVote(null);
        }
      } else if (type === 'debug-host-action') {
        if (isHost) {
          const payloadObj = payload as { action: string; [key: string]: unknown };
          handleDebugHostAction(payloadObj.action, payloadObj);
        }
      } else if (isHost) {
        if (type === 'submit-answers') {
          if (senderId) {
            const data = payload as { answers: Record<string, string> };
            handleClientSubmitAnswers(senderId, data.answers);
          }
        } else if (type === 'submit-vote') {
          if (senderId) {
            const data = payload as { choice: string };
            handleClientSubmitVote(senderId, data.choice);
          }
        } else if (type === 'joke-factory-request-state') {
          if (phaseRef.current !== 'starting') {
            broadcastState({});
          }
        }
      }
    });
  });

  const prompts = playerPrompts[playerId] || [];
  const submissionCount = Object.keys(playerAnswers).length;

  return (
    <JokeFactoryViews
      phase={phase}
      round={round}
      roster={roster}
      playerId={playerId}
      isDisplay={isDisplay}
      isHost={isHost}
      prompts={prompts}
      writingSec={writingSec}
      answersSubmitted={answersSubmitted}
      onSubmitAnswers={handleSubmitAnswers}
      submissionCount={submissionCount}
      
      matchups={matchups}
      currentMatchIndex={currentMatchIndex}
      votingSec={votingSec}
      resultsSec={resultsSec}
      myVote={myVote}
      onSubmitVote={handleSubmitVote}
      scores={scores}
      handleNextRound={handleNextRound}
      endGame={onQuit}
      round3Data={round3Data}
    />
  );
}
