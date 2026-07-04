import { useEffect, useRef, useState } from 'react';
import { useGameSocket } from '../../hooks/useGameSocket';
import { useCountdown } from '../../hooks/useCountdown';
import { loadDictionary } from '../../utils/dictionary';
import { buildWordLibrary } from '../../utils/posTagging';
import { assignLibraries } from '../../utils/derangement';
import { buildDropdownOptions } from '../../utils/fallbackMerge';
import templatesData from '../../data/templates.json';
import {
  JOIN_MAX_ATTEMPTS,
  JOIN_RETRY_INTERVAL_MS,
  ROUND1_DURATION_MS,
  ROUND2_DURATION_MS,
  VOTING_DURATION_MS,
  GRACE_PERIOD_MS,
  SUBMIT_RETRY_INTERVAL_MS,
  SUBMIT_MAX_ATTEMPTS,
} from '../../constants';
import type {
  Envelope,
  GamePhase,
  JoinAckPayload,
  JoinRequestPayload,
  MadLibTemplate,
  PlayerAssignment,
  PlayerInfo,
  PlayerSheetResult,
  ResultsPayload,
  Round1StartPayload,
  Round2AssignmentsPayload,
  SheetSubmitPayload,
  VoteSubmitPayload,
  WinnerPayload,
  WordLibrary,
  WordLibrarySubmitPayload,
} from '../../types';
import Lobby from './Lobby';
import Round1Typing from './Round1Typing';
import Round2Sheet from './Round2Sheet';
import VotingScreen from './VotingScreen';
import WinnerScreen from './WinnerScreen';

const TEMPLATES = templatesData as MadLibTemplate[];

interface GameSessionProps {
  code: string;
  playerId: string;
  name: string;
  isHost: boolean;
  onLeaveGame: () => void;
  onPlayAgain?: () => void;
}

export default function GameSession({ code, playerId, name, isHost, onLeaveGame, onPlayAgain }: GameSessionProps) {
  // The host doesn't need a network round trip to join its own game — it is
  // the authority on the roster, so it seeds itself in directly rather than
  // depending on ntfy echoing its own join-request back to itself (which is
  // not guaranteed, and would otherwise strand the host on a spinner if that
  // echo is ever dropped).
  const [phase, setPhase] = useState<GamePhase>(isHost ? 'lobby' : 'joining');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [roster, setRoster] = useState<PlayerInfo[]>(isHost ? [{ id: playerId, name }] : []);
  const [round1EndTimestamp, setRound1EndTimestamp] = useState<number | null>(null);
  const [myWords, setMyWords] = useState<string[]>([]);
  const [round2EndTimestamp, setRound2EndTimestamp] = useState<number | null>(null);
  const [assignedLibrary, setAssignedLibrary] = useState<WordLibrary | null>(null);
  const [template, setTemplate] = useState<MadLibTemplate | null>(null);
  const [mySheetAnswers, setMySheetAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, PlayerSheetResult> | null>(null);
  const [votingEndTimestamp, setVotingEndTimestamp] = useState<number | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voteLocked, setVoteLocked] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<WinnerPayload | null>(null);
  const [round1Progress, setRound1Progress] = useState(0);
  const [round2Progress, setRound2Progress] = useState(0);

  // Refs mirroring reactive state so the ntfy message handler (recreated each
  // render, but only reassigned into useGameSocket's ref via an effect after
  // commit) always reacts to the latest committed values, not a stale one.
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const rosterRef = useRef(roster);
  useEffect(() => { rosterRef.current = roster; }, [roster]);
  const myWordsRef = useRef(myWords);
  useEffect(() => { myWordsRef.current = myWords; }, [myWords]);
  const mySheetAnswersRef = useRef(mySheetAnswers);
  useEffect(() => { mySheetAnswersRef.current = mySheetAnswers; }, [mySheetAnswers]);
  const templateRef = useRef(template);
  useEffect(() => { templateRef.current = template; }, [template]);
  const assignedLibraryRef = useRef(assignedLibrary);
  useEffect(() => { assignedLibraryRef.current = assignedLibrary; }, [assignedLibrary]);

  // Host-only bookkeeping. Not reactive state (except the progress counters
  // above) since only the host needs to read/write these when deciding phase
  // transitions and composing broadcasts.
  const wordLibrariesRef = useRef(new Map<string, WordLibrary>());
  const sheetsRef = useRef(new Map<string, PlayerSheetResult>());
  const assignmentsRef = useRef<Record<string, PlayerAssignment>>({});
  const hostTemplateRef = useRef<MadLibTemplate | null>(null);
  const votesRef = useRef(new Map<string, string>());
  const votedPlayersRef = useRef(new Set<string>());
  const votingSheetsRef = useRef<Record<string, PlayerSheetResult> | null>(null);
  const round2StartedRef = useRef(false);
  const votingStartedRef = useRef(false);
  const winnerAnnouncedRef = useRef(false);
  const round1SubmittedRef = useRef(false);
  const round2SubmittedRef = useRef(false);
  const voteSubmittedRef = useRef(false);

  // Retry bookkeeping for round 1/2 submissions: the payload to keep
  // resending, and whether the host has acked it yet.
  const round1LibraryRef = useRef<WordLibrary | null>(null);
  const round1AckedRef = useRef(false);
  const round2AnswersRef = useRef<Record<string, string> | null>(null);
  const round2AckedRef = useRef(false);

  // Prefetch the dictionary and POS tagger during the lobby's idle time,
  // before round 1 starts.
  useEffect(() => {
    loadDictionary();
  }, []);

  const handleMessage = (data: unknown) => {
    const envelope = data as Envelope;

    // --- Host-only reactions: react to player intents, own the canonical state ---
    if (isHost) {
      if (envelope.type === 'join-request') {
        const payload = envelope.payload as JoinRequestPayload;
        const fromId = envelope.playerId;
        if (!fromId || !payload?.name) return;
        hostReceiveJoinRequest(fromId, payload.name);
      } else if (envelope.type === 'word-library-submit') {
        const fromId = envelope.playerId;
        if (!fromId) return;
        const payload = envelope.payload as WordLibrarySubmitPayload;
        hostReceiveWordLibrary(fromId, payload.library);
      } else if (envelope.type === 'sheet-submit') {
        const fromId = envelope.playerId;
        if (!fromId) return;
        const payload = envelope.payload as SheetSubmitPayload;
        hostReceiveSheetSubmit(fromId, payload.answers);
      } else if (envelope.type === 'vote-submit') {
        const fromId = envelope.playerId;
        if (!fromId) return;
        const payload = envelope.payload as VoteSubmitPayload;
        hostReceiveVote(fromId, payload.targetPlayerId, payload.final);
      }
    }

    // --- Player-facing reactions: everyone (including host-as-player) follows the broadcasts ---
    if (envelope.type === 'join-ack') {
      if (envelope.playerId !== playerId) return;
      if (phaseRef.current !== 'joining') return;
      const payload = envelope.payload as JoinAckPayload;
      if (payload.accepted) {
        setPhase('lobby');
      } else {
        setPhase('join');
        setErrorMsg(payload.reason ?? 'Could not join the game.');
      }
    } else if (envelope.type === 'roster-update') {
      const payload = envelope.payload as { players: PlayerInfo[] };
      setRoster(payload.players);
    } else if (envelope.type === 'round1-start') {
      if (phaseRef.current !== 'lobby') return;
      const payload = envelope.payload as Round1StartPayload;
      round1SubmittedRef.current = false;
      round1AckedRef.current = false;
      round1LibraryRef.current = null;
      setMyWords([]);
      setRound1EndTimestamp(payload.endTimestamp);
      setPhase('round1');
    } else if (envelope.type === 'word-library-ack') {
      if (envelope.playerId !== playerId) return;
      round1AckedRef.current = true;
    } else if (envelope.type === 'round2-assignments') {
      if (phaseRef.current === 'round2' || phaseRef.current === 'round2-waiting' || phaseRef.current === 'voting' || phaseRef.current === 'winner') return;
      const payload = envelope.payload as Round2AssignmentsPayload;
      const mine = payload.assignments[playerId];
      round2SubmittedRef.current = false;
      round2AckedRef.current = false;
      round2AnswersRef.current = null;
      if (!mine) {
        setPhase('round2-dropped');
        return;
      }
      setAssignedLibrary(mine.library);
      setTemplate(payload.template);
      setMySheetAnswers({});
      setRound2EndTimestamp(payload.endTimestamp);
      setPhase('round2');
    } else if (envelope.type === 'sheet-submit-ack') {
      if (envelope.playerId !== playerId) return;
      round2AckedRef.current = true;
    } else if (envelope.type === 'results') {
      const payload = envelope.payload as ResultsPayload;
      setResults(payload.sheets);
      setVotingEndTimestamp(payload.votingEndTimestamp);
      setMyVote(null);
      setVoteLocked(false);
      voteSubmittedRef.current = false;
      setPhase('voting');
    } else if (envelope.type === 'winner-announced') {
      const payload = envelope.payload as WinnerPayload;
      setWinnerInfo(payload);
      setPhase('winner');
    }
  };

  const { sendMessage } = useGameSocket(code, handleMessage);

  // These host-authority reactions are called both from handleMessage (for
  // real network messages from other players) and directly/locally for the
  // host's own actions, since the host's own published message is not
  // guaranteed to echo back to itself over its own ntfy subscription — it
  // shouldn't have to wait on a flaky round trip to react to its own intents.
  // Keyed Map.set()s make calling a function twice for the same player
  // (e.g. a direct call plus a later echoed duplicate) harmless.
  function hostReceiveJoinRequest(fromId: string, fromName: string) {
    const alreadyJoined = rosterRef.current.some((p) => p.id === fromId);

    // A late-arriving retry from someone who already successfully joined
    // (their own join-ack echo was just slow/lost) is not a new join attempt
    // — re-ack it so they can recover, rather than bouncing them to an error
    // screen just because the game has since started without them noticing.
    if (phaseRef.current !== 'lobby' && phaseRef.current !== 'joining' && !alreadyJoined) {
      sendMessage({
        type: 'join-ack',
        playerId: fromId,
        timestamp: Date.now(),
        payload: { accepted: false, reason: 'Game already in progress.' },
      });
      return;
    }

    const exists = alreadyJoined || rosterRef.current.some(
      (p) => p.name.trim().toLowerCase() === fromName.trim().toLowerCase()
    );
    const nextRoster = exists
      ? rosterRef.current.map((p) =>
          p.id === fromId || p.name.trim().toLowerCase() === fromName.trim().toLowerCase()
            ? { id: fromId, name: fromName }
            : p
        )
      : [...rosterRef.current, { id: fromId, name: fromName }];
    rosterRef.current = nextRoster;
    setRoster(nextRoster);

    sendMessage({
      type: 'join-ack',
      playerId: fromId,
      timestamp: Date.now(),
      payload: { accepted: true },
    });
    sendMessage({
      type: 'roster-update',
      timestamp: Date.now(),
      payload: { players: nextRoster },
    });
  }

  function hostReceiveWordLibrary(fromId: string, library: WordLibrary) {
    // Gate on the host-authority ref, not phaseRef: the host's own personal
    // phase flips to 'round1-waiting' the instant ITS OWN timer fires (zero
    // network latency), which happens well before other players' submissions
    // — sent over the network — arrive. Gating on phaseRef would silently
    // reject every other player's submission (and every retry of it) the
    // moment the host's own local clock hit zero.
    if (round2StartedRef.current) return;
    wordLibrariesRef.current.set(fromId, library);
    setRound1Progress(wordLibrariesRef.current.size);
    sendMessage({ type: 'word-library-ack', playerId: fromId, timestamp: Date.now(), payload: {} });
    if (wordLibrariesRef.current.size >= rosterRef.current.length) {
      advanceToRound2();
    }
  }

  function hostReceiveSheetSubmit(fromId: string, answers: Record<string, string>) {
    // Same rationale as hostReceiveWordLibrary above — gate on the
    // host-authority ref, not the host's own racing-ahead local phase.
    if (votingStartedRef.current) return;
    const tmpl = hostTemplateRef.current;
    if (!tmpl) return;
    const playerName = rosterRef.current.find((p) => p.id === fromId)?.name ?? 'Unknown';
    sheetsRef.current.set(fromId, {
      playerId: fromId,
      playerName,
      templateId: tmpl.id,
      answers,
      renderedText: renderTemplate(tmpl, answers),
    });
    setRound2Progress(sheetsRef.current.size);
    sendMessage({ type: 'sheet-submit-ack', playerId: fromId, timestamp: Date.now(), payload: {} });
    const expectedCount = Object.keys(assignmentsRef.current).length;
    if (sheetsRef.current.size >= expectedCount) {
      advanceToVoting();
    }
  }

  function hostReceiveVote(fromId: string, targetPlayerId: string | null, final: boolean) {
    // Same rationale as hostReceiveWordLibrary above.
    if (winnerAnnouncedRef.current) return;
    if (targetPlayerId) {
      votesRef.current.set(fromId, targetPlayerId);
    } else {
      votesRef.current.delete(fromId);
    }
    if (final) {
      votedPlayersRef.current.add(fromId);
      if (votedPlayersRef.current.size >= rosterRef.current.length) {
        advanceToWinner();
      }
    }
  }

  function advanceToRound2() {
    if (round2StartedRef.current) return;
    round2StartedRef.current = true;
    const assignments = assignLibraries(wordLibrariesRef.current);
    const chosenTemplate = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    assignmentsRef.current = assignments;
    hostTemplateRef.current = chosenTemplate;
    const endTimestamp = Date.now() + ROUND2_DURATION_MS;
    sendMessage({
      type: 'round2-assignments',
      timestamp: Date.now(),
      payload: { assignments, template: chosenTemplate, endTimestamp },
    });
    setTimeout(() => advanceToVoting(), ROUND2_DURATION_MS + GRACE_PERIOD_MS);
  }

  function advanceToVoting() {
    if (votingStartedRef.current) return;
    votingStartedRef.current = true;
    const sheets: Record<string, PlayerSheetResult> = {};
    sheetsRef.current.forEach((sheet, id) => {
      sheets[id] = sheet;
    });
    votingSheetsRef.current = sheets;
    const votingEndTimestamp = Date.now() + VOTING_DURATION_MS;
    sendMessage({ type: 'results', timestamp: Date.now(), payload: { sheets, votingEndTimestamp } });
    setTimeout(() => advanceToWinner(), VOTING_DURATION_MS + GRACE_PERIOD_MS);
  }

  // Called both by the voting-timer grace-period fallback and, early, as
  // soon as every roster member has hit their own "Submit" button — mirrors
  // the everyone-submitted fast path already used for rounds 1 and 2.
  function advanceToWinner() {
    if (winnerAnnouncedRef.current) return;
    winnerAnnouncedRef.current = true;
    const sheets = votingSheetsRef.current ?? {};
    const tally: Record<string, number> = {};
    votesRef.current.forEach((targetId) => {
      if (sheets[targetId]) tally[targetId] = (tally[targetId] ?? 0) + 1;
    });
    const maxVotes = Math.max(0, ...Object.values(tally));
    const winnerPlayerIds = maxVotes > 0 ? Object.keys(tally).filter((id) => tally[id] === maxVotes) : [];
    sendMessage({ type: 'winner-announced', timestamp: Date.now(), payload: { winnerPlayerIds, votes: tally } });
  }

  function startGame() {
    if (phaseRef.current !== 'lobby') return;
    round2StartedRef.current = false;
    votingStartedRef.current = false;
    winnerAnnouncedRef.current = false;
    wordLibrariesRef.current = new Map();
    sheetsRef.current = new Map();
    votesRef.current = new Map();
    votedPlayersRef.current = new Set();
    votingSheetsRef.current = null;
    setRound1Progress(0);
    setRound2Progress(0);
    const endTimestamp = Date.now() + ROUND1_DURATION_MS;
    sendMessage({ type: 'round1-start', timestamp: Date.now(), payload: { endTimestamp } });
    setTimeout(() => advanceToRound2(), ROUND1_DURATION_MS + GRACE_PERIOD_MS);
  }

  // Join handshake: retry until the host acks, mirrors botc's join-retry pattern.
  useEffect(() => {
    if (phase !== 'joining') return;
    let attempts = 0;
    const trySend = () => {
      sendMessage({ type: 'join-request', playerId, timestamp: Date.now(), payload: { name } });
      attempts++;
      if (attempts >= JOIN_MAX_ATTEMPTS) {
        clearInterval(interval);
        setPhase('join');
        setErrorMsg('Could not reach the host. Double check the code and that they have the game open.');
      }
    };
    trySend();
    const interval = setInterval(trySend, JOIN_RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase, playerId, name, sendMessage]);

  // Round 1 local timer expiry: tag words, submit, and wait for the host.
  const round1Countdown = useCountdown(round1EndTimestamp);
  useEffect(() => {
    if (phase === 'round1' && round1Countdown.expired && !round1SubmittedRef.current) {
      round1SubmittedRef.current = true;
      const library = buildWordLibrary(myWordsRef.current);
      round1LibraryRef.current = library;
      sendMessage({ type: 'word-library-submit', playerId, timestamp: Date.now(), payload: { library } });
      if (isHost) hostReceiveWordLibrary(playerId, library);
      setPhase('round1-waiting');
    }
  }, [phase, round1Countdown.expired, playerId, sendMessage, isHost]);

  // Every client's round-1 timer expires at the exact same synced instant,
  // so all their word-library-submit messages burst over ntfy at once — a
  // stress case for best-effort delivery. Keep resending (the host's
  // Map.set() dedupes duplicates harmlessly) until acked or we give up.
  useEffect(() => {
    if (isHost || phase !== 'round1-waiting') return;
    let attempts = 0;
    const trySend = () => {
      if (round1AckedRef.current || !round1LibraryRef.current) {
        clearInterval(interval);
        return;
      }
      sendMessage({ type: 'word-library-submit', playerId, timestamp: Date.now(), payload: { library: round1LibraryRef.current } });
      attempts++;
      if (attempts >= SUBMIT_MAX_ATTEMPTS) clearInterval(interval);
    };
    const interval = setInterval(trySend, SUBMIT_RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase, isHost, playerId, sendMessage]);

  // Shared by both the manual "Submit" button and the timer-expiry auto-submit
  // below, guarded by round2SubmittedRef so only the first caller wins.
  function submitRound2Sheet(finalAnswers: Record<string, string>) {
    if (round2SubmittedRef.current) return;
    round2SubmittedRef.current = true;
    round2AnswersRef.current = finalAnswers;
    sendMessage({ type: 'sheet-submit', playerId, timestamp: Date.now(), payload: { answers: finalAnswers } });
    if (isHost) hostReceiveSheetSubmit(playerId, finalAnswers);
    setPhase('round2-waiting');
  }

  // Round 2 local timer expiry: auto-fill unset blanks, submit, and wait.
  const round2Countdown = useCountdown(round2EndTimestamp);
  useEffect(() => {
    if (phase === 'round2' && round2Countdown.expired && !round2SubmittedRef.current) {
      const tmpl = templateRef.current;
      const library = assignedLibraryRef.current;
      if (!tmpl || !library) return;
      const options = buildDropdownOptions(library, tmpl);
      const finalAnswers = { ...mySheetAnswersRef.current };
      for (const blank of tmpl.blanks) {
        if (!finalAnswers[blank.id]) {
          finalAnswers[blank.id] = options[blank.id]?.[0] ?? '';
        }
      }
      submitRound2Sheet(finalAnswers);
    }
  }, [phase, round2Countdown.expired, playerId, sendMessage, isHost]);

  // Same rationale as the round-1 retry above: resend the sheet submission
  // until the host acks it or we give up.
  useEffect(() => {
    if (isHost || phase !== 'round2-waiting') return;
    let attempts = 0;
    const trySend = () => {
      if (round2AckedRef.current || !round2AnswersRef.current) {
        clearInterval(interval);
        return;
      }
      sendMessage({ type: 'sheet-submit', playerId, timestamp: Date.now(), payload: { answers: round2AnswersRef.current } });
      attempts++;
      if (attempts >= SUBMIT_MAX_ATTEMPTS) clearInterval(interval);
    };
    const interval = setInterval(trySend, SUBMIT_RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase, isHost, playerId, sendMessage]);

  const addWord = (word: string) => setMyWords((prev) => [...prev, word]);
  const setAnswer = (blankId: string, value: string) =>
    setMySheetAnswers((prev) => ({ ...prev, [blankId]: value }));
  const submitMySheet = () => submitRound2Sheet(mySheetAnswers);

  // Tapping a card you've already voted for retracts the vote; tapping any
  // other card moves it there — only ever one active vote per player. This
  // is provisional (final: false) — it counts toward the timer-expiry tally
  // either way, but doesn't count toward the everyone-submitted fast path.
  const castVote = (targetPlayerId: string) => {
    if (voteSubmittedRef.current) return;
    const nextVote = myVote === targetPlayerId ? null : targetPlayerId;
    setMyVote(nextVote);
    sendMessage({ type: 'vote-submit', playerId, timestamp: Date.now(), payload: { targetPlayerId: nextVote, final: false } });
    if (isHost) hostReceiveVote(playerId, nextVote, false);
  };

  const submitVote = () => {
    if (voteSubmittedRef.current || !myVote) return;
    voteSubmittedRef.current = true;
    sendMessage({ type: 'vote-submit', playerId, timestamp: Date.now(), payload: { targetPlayerId: myVote, final: true } });
    if (isHost) hostReceiveVote(playerId, myVote, true);
    setVoteLocked(true);
  };

  const playAgain = () => {
    onPlayAgain?.();
  };

  const goToMainMenu = () => {
    window.location.hash = '#/';
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center pt-2">
      {phase === 'joining' && (
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brodin-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Connecting to room {code}...</p>
        </div>
      )}

      {phase === 'join' && errorMsg && (
        <div className="max-w-md text-center space-y-3">
          <p className="text-red-400 text-sm font-semibold">{errorMsg}</p>
          <button onClick={onLeaveGame} className="text-sm text-gray-400 underline">Try again</button>
        </div>
      )}

      {phase === 'lobby' && (
        <Lobby code={code} roster={roster} isHost={isHost} onStartGame={startGame} />
      )}

      {phase === 'round1' && round1EndTimestamp && (
        <Round1Typing endTimestamp={round1EndTimestamp} words={myWords} onAddWord={addWord} />
      )}

      {phase === 'round1-waiting' && (
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-400">
            Waiting for other players...{isHost && ` (${round1Progress}/${roster.length} submitted)`}
          </p>
        </div>
      )}

      {phase === 'round2' && round2EndTimestamp && template && assignedLibrary && (
        <Round2Sheet
          endTimestamp={round2EndTimestamp}
          template={template}
          assignedLibrary={assignedLibrary}
          answers={mySheetAnswers}
          onAnswerChange={setAnswer}
          onSubmit={submitMySheet}
        />
      )}

      {phase === 'round2-waiting' && (
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-400">
            Waiting for other players...{isHost && ` (${round2Progress}/${Object.keys(assignmentsRef.current).length} submitted)`}
          </p>
        </div>
      )}

      {phase === 'round2-dropped' && (
        <p className="text-sm text-gray-400 text-center">
          Your round 1 submission arrived too late, so you sat out round 2. Waiting for results...
        </p>
      )}

      {phase === 'voting' && results && votingEndTimestamp && (
        <VotingScreen
          endTimestamp={votingEndTimestamp}
          sheets={results}
          myVote={myVote}
          locked={voteLocked}
          onVote={castVote}
          onSubmit={submitVote}
        />
      )}

      {phase === 'winner' && results && winnerInfo && (
        <WinnerScreen
          sheets={results}
          winnerPlayerIds={winnerInfo.winnerPlayerIds}
          votes={winnerInfo.votes}
          isHost={isHost}
          onPlayAgain={playAgain}
          onEndSession={goToMainMenu}
          onDisconnect={goToMainMenu}
        />
      )}
    </div>
  );
}

function renderTemplate(template: MadLibTemplate, answers: Record<string, string>): string {
  let text = template.text;
  for (const blank of template.blanks) {
    text = text.replaceAll(`{{${blank.id}}}`, answers[blank.id] ?? '???');
  }
  return text;
}
