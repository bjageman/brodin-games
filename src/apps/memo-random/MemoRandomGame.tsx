import { useEffect, useRef, useState, useCallback } from 'react';
import { useCountdown } from '../../shared/hooks/useCountdown';
import { loadDictionary } from './utils/dictionary';
import { audioManager } from '../../shared/utils/audio';
import { buildDropdownOptions } from './utils/fallbackMerge';
import { saveSnapshot, loadSnapshot, gameSnapshotKey } from '../../shared/utils/sessionSnapshot';
import {
  GRACE_PERIOD_MS,
  SUBMIT_RETRY_INTERVAL_MS,
  SUBMIT_MAX_ATTEMPTS,
  MAX_WORDS_PER_CATEGORY,
} from './constants';
import { emptyLibrary, CATEGORIES } from './types';
import { useMemoRandomDebug } from './useMemoRandomDebug';
import { useMemoRandomHost, type HostSnapshot } from './useMemoRandomHost';
import type {
  Category,
  MemoRandomPhase,
  MadLibTemplate,
  MatchResultPayload,
  MatchupSide,
  MatchupStartPayload,
  PlayerSheetResult,
  Round1StartPayload,
  Round2AssignmentsPayload,
  SheetSubmitPayload,
  VoteSubmitAckPayload,
  VoteSubmitPayload,
  WinnerPayload,
  WordLibrary,
  WordLibrarySubmitPayload,
} from './types';
import type { Envelope } from '../../shared/types';
import type { GamePlayProps } from '../../shared/GameShell';
import Round1Typing from './components/Round1Typing';
import Round2Sheet from './components/Round2Sheet';
import MatchupScreen from './components/MatchupScreen';
import MatchResultScreen from './components/MatchResultScreen';
import WinnerScreen from './components/WinnerScreen';
import { DEBUG_MODE } from '../../shared/constants';

// Host-only bookkeeping, persisted across refresh. Maps/Sets as arrays since sessionStorage only holds JSON.

// Field is `gamePhase`, not `phase`, so it doesn't collide with GameShell's own `phase` in the same entry.
interface MemoRandomSnapshot {
  gamePhase: MemoRandomPhase;
  round1EndTimestamp: number | null;
  myLibrary: WordLibrary;
  round2EndTimestamp: number | null;
  assignedLibrary: WordLibrary | null;
  template: MadLibTemplate | null;
  mySheetAnswers: Record<string, string>;
  currentMatchup: MatchupStartPayload | null;
  matchResult: MatchResultPayload | null;
  myMatchVote: MatchupSide | null;
  matchVoteLocked: boolean;
  seenSheets: Record<string, PlayerSheetResult>;
  winnerInfo: WinnerPayload | null;
  round1Progress: number;
  round2Progress: number;
  round1Submitted: boolean;
  round2Submitted: boolean;
  matchVoteSubmitted: boolean;
  round1Library: WordLibrary | null;
  round2Answers: Record<string, string> | null;
  host?: HostSnapshot;
}

export default function MemoRandomGame({ code, playerId, isHost, roster, isConnected, sendMessage, isDisplay, freshStart, onRegisterMessageHandler, onQuit, onRegisterDebugActions }: GamePlayProps) {
  const restored = freshStart ? null : loadSnapshot<MemoRandomSnapshot>(gameSnapshotKey(code));

  const [phase, setPhase] = useState<MemoRandomPhase>(restored?.gamePhase ?? 'starting');

  const [round1EndTimestamp, setRound1EndTimestamp] = useState<number | null>(restored?.round1EndTimestamp ?? null);
  const [myLibrary, setMyLibrary] = useState<WordLibrary>(restored?.myLibrary ?? emptyLibrary());
  const [round2EndTimestamp, setRound2EndTimestamp] = useState<number | null>(restored?.round2EndTimestamp ?? null);
  const [assignedLibrary, setAssignedLibrary] = useState<WordLibrary | null>(restored?.assignedLibrary ?? null);
  const [template, setTemplate] = useState<MadLibTemplate | null>(restored?.template ?? null);
  const [mySheetAnswers, setMySheetAnswers] = useState<Record<string, string>>(restored?.mySheetAnswers ?? {});
  const [currentMatchup, setCurrentMatchup] = useState<MatchupStartPayload | null>(restored?.currentMatchup ?? null);
  const [matchResult, setMatchResult] = useState<MatchResultPayload | null>(restored?.matchResult ?? null);
  const [myMatchVote, setMyMatchVote] = useState<MatchupSide | null>(restored?.myMatchVote ?? null);
  const [matchVoteLocked, setMatchVoteLocked] = useState(restored?.matchVoteLocked ?? false);
  const [seenSheets, setSeenSheets] = useState<Record<string, PlayerSheetResult>>(restored?.seenSheets ?? {});
  const [winnerInfo, setWinnerInfo] = useState<WinnerPayload | null>(restored?.winnerInfo ?? null);
  const [round1Progress, setRound1Progress] = useState(restored?.round1Progress ?? 0);
  const [round2Progress, setRound2Progress] = useState(restored?.round2Progress ?? 0);

  const [muted, setMuted] = useState(audioManager.getMuted());

  const handleToggleMute = () => {
    const nextMuted = audioManager.toggleMute();
    setMuted(nextMuted);
  };

  // Play ambient office noise
  useEffect(() => {
    if (phase !== 'starting' && phase !== 'winner') {
      audioManager.startAmbientNoise();
    } else {
      audioManager.stopAmbientNoise();
    }
    return () => {
      audioManager.stopAmbientNoise();
    };
  }, [phase]);

  // Play result sound effects (Success/Failure)
  useEffect(() => {
    if (phase === 'matchup-results' && matchResult) {
      const isWinner =
        (matchResult.leftVotes > matchResult.rightVotes && matchResult.left.playerId === playerId) ||
        (matchResult.rightVotes > matchResult.leftVotes && matchResult.right.playerId === playerId);
      const isLoser =
        (matchResult.leftVotes > matchResult.rightVotes && matchResult.right.playerId === playerId) ||
        (matchResult.rightVotes > matchResult.leftVotes && matchResult.left.playerId === playerId);
      if (isWinner) {
        audioManager.playSuccess();
      } else if (isLoser) {
        audioManager.playFailure();
      }
    }
  }, [phase, matchResult, playerId]);

  // Refs mirror state so handleMessage always reads the latest committed values.
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const rosterRef = useRef(roster);
  useEffect(() => { rosterRef.current = roster; }, [roster]);
  const myLibraryRef = useRef(myLibrary);
  useEffect(() => { myLibraryRef.current = myLibrary; }, [myLibrary]);
  const mySheetAnswersRef = useRef(mySheetAnswers);
  useEffect(() => { mySheetAnswersRef.current = mySheetAnswers; }, [mySheetAnswers]);
  const templateRef = useRef(template);
  useEffect(() => { templateRef.current = template; }, [template]);
  const assignedLibraryRef = useRef(assignedLibrary);
  useEffect(() => { assignedLibraryRef.current = assignedLibrary; }, [assignedLibrary]);

  // Host-only bookkeeping; not reactive state since only the host reads/writes it.
  const round1SubmittedRef = useRef(restored?.round1Submitted ?? false);
  const round2SubmittedRef = useRef(restored?.round2Submitted ?? false);
  const matchVoteSubmittedRef = useRef(restored?.matchVoteSubmitted ?? false);

  // Acked flags deliberately NOT restored — resending an already-acked submission is harmless, skipping a needed one isn't.
  const round1LibraryRef = useRef<WordLibrary | null>(restored?.round1Library ?? null);
  const round1AckedRef = useRef(false);
  const round2AnswersRef = useRef<Record<string, string> | null>(restored?.round2Answers ?? null);
  const round2AckedRef = useRef(false);
  const matchVoteAckedRef = useRef(false);

  // Debug controls
  const activeTimeoutRef = useRef<{ id: ReturnType<typeof setTimeout>; callback: () => void; scheduledAt: number; delay: number } | null>(null);
  const remainingTimeRef = useRef<number | null>(null);
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  const setGameTimeout = useCallback((callback: () => void, delayMs: number) => {
    if (activeTimeoutRef.current) {
      clearTimeout(activeTimeoutRef.current.id);
    }
    if (isTimerPaused) {
      remainingTimeRef.current = delayMs;
      activeTimeoutRef.current = { id: setTimeout(() => {}, 0), callback, scheduledAt: Date.now(), delay: delayMs };
      clearTimeout(activeTimeoutRef.current.id);
      return;
    }
    const id = setTimeout(() => {
      activeTimeoutRef.current = null;
      callback();
    }, delayMs);
    activeTimeoutRef.current = { id, callback, scheduledAt: Date.now(), delay: delayMs };
  }, [isTimerPaused]);

  // The host's game engine (round orchestration, matchmaking, scoring); returns
  // the host-only bookkeeping refs so routing/snapshot/debug share the instances.
  const {
    wordLibrariesRef, sheetsRef, assignmentsRef, pairingsRef, matchupsRef, currentMatchIndexRef,
    matchVotesRef, matchVotedPlayersRef, matchAdvancedRef, expectedVotersRef, scoresRef,
    round2StartedRef, matchupsStartedRef, winnerAnnouncedRef,
    hostReceiveWordLibrary, hostReceiveSheetSubmit, hostReceiveVote,
    advanceToRound2, advanceToMatchups, startMatch, finishMatch, beginRound1,
  } = useMemoRandomHost({
    restored: restored?.host, rosterRef, sendMessage, setGameTimeout,
    setRound1Progress, setRound2Progress, setSeenSheets,
  });

  // Dev-only host controls (host engine helpers above are passed in as context).
  const { handleDebugHostAction, getDebugActions } = useMemoRandomDebug({
    isHost, playerId, sendMessage, phase, isTimerPaused, setIsTimerPaused,
    activeTimeoutRef, remainingTimeRef, currentMatchup, setCurrentMatchup,
    setRound1EndTimestamp, setRound2EndTimestamp, advanceToRound2, advanceToMatchups,
    finishMatch, startMatch, hostReceiveWordLibrary, hostReceiveSheetSubmit, hostReceiveVote,
    rosterRef, wordLibrariesRef, assignmentsRef, sheetsRef, matchupsRef,
    currentMatchIndexRef, matchVotedPlayersRef,
  });

  // Fallback in case GameShell's onIdlePrefetch didn't already warm this up.
  useEffect(() => {
    loadDictionary();
  }, []);

  // Merges into whatever GameShell has already saved under the same key.
  useEffect(() => {
    const snapshot: MemoRandomSnapshot = {
      gamePhase: phase,
      round1EndTimestamp,
      myLibrary,
      round2EndTimestamp,
      assignedLibrary,
      template,
      mySheetAnswers,
      currentMatchup,
      matchResult,
      myMatchVote,
      matchVoteLocked,
      seenSheets,
      winnerInfo,
      round1Progress,
      round2Progress,
      round1Submitted: round1SubmittedRef.current,
      round2Submitted: round2SubmittedRef.current,
      matchVoteSubmitted: matchVoteSubmittedRef.current,
      round1Library: round1LibraryRef.current,
      round2Answers: round2AnswersRef.current,
      host: isHost
        ? {
            wordLibraries: Array.from(wordLibrariesRef.current.entries()),
            sheets: Array.from(sheetsRef.current.entries()),
            assignments: assignmentsRef.current,
            pairings: pairingsRef.current,
            matchups: matchupsRef.current,
            currentMatchIndex: currentMatchIndexRef.current,
            matchVotes: Array.from(matchVotesRef.current.entries()),
            matchVotedPlayers: Array.from(matchVotedPlayersRef.current),
            scores: scoresRef.current,
            round2Started: round2StartedRef.current,
            matchupsStarted: matchupsStartedRef.current,
            winnerAnnounced: winnerAnnouncedRef.current,
            matchAdvanced: matchAdvancedRef.current,
            expectedVoters: expectedVotersRef.current,
          }
        : undefined,
    };
    const current = loadSnapshot<Record<string, unknown>>(gameSnapshotKey(code)) ?? {};
    saveSnapshot(gameSnapshotKey(code), { ...current, ...snapshot });
  }, [
    code, isHost, phase, round1EndTimestamp, myLibrary, round2EndTimestamp, assignedLibrary,
    template, mySheetAnswers, currentMatchup, matchResult, myMatchVote, matchVoteLocked, seenSheets,
    winnerInfo, round1Progress, round2Progress, assignmentsRef, currentMatchIndexRef,
    expectedVotersRef, matchAdvancedRef, matchVotedPlayersRef, matchVotesRef, matchupsRef,
    matchupsStartedRef, pairingsRef, round2StartedRef, scoresRef, sheetsRef, winnerAnnouncedRef,
    wordLibrariesRef
  ]);

  // Register debug actions with GameShell
  useEffect(() => {
    if (DEBUG_MODE && onRegisterDebugActions) {
      onRegisterDebugActions(getDebugActions(), phase);
    }
  }, [phase, isTimerPaused, round1Progress, round2Progress, currentMatchup?.matchIndex, getDebugActions, onRegisterDebugActions]);

  // A host refresh kills every pending setTimeout fallback — re-arm whichever one applies, timed off the
  // persisted absolute end-timestamp so it still fires at the original real-world moment.
  const hasRestoredTimeout = useRef(false);
  useEffect(() => {
    if (!isHost || freshStart || !restored || hasRestoredTimeout.current) return;
    hasRestoredTimeout.current = true;
    const now = Date.now();
    if (phase === 'round1' || phase === 'round1-waiting') {
      const delay = Math.max(0, (restored.round1EndTimestamp ?? now) + GRACE_PERIOD_MS - now);
      setGameTimeout(() => advanceToRound2(), delay);
    } else if (phase === 'round2' || phase === 'round2-waiting') {
      const delay = Math.max(0, (restored.round2EndTimestamp ?? now) + GRACE_PERIOD_MS - now);
      setGameTimeout(() => advanceToMatchups(), delay);
    } else if (phase === 'matchup') {
      const delay = Math.max(0, (restored.currentMatchup?.endTimestamp ?? now) + GRACE_PERIOD_MS - now);
      setGameTimeout(() => finishMatch(restored.host?.currentMatchIndex ?? 0), delay);
    } else if (phase === 'matchup-results') {
      const delay = Math.max(0, (restored.matchResult?.resultsEndTimestamp ?? now) - now);
      setGameTimeout(() => startMatch((restored.host?.currentMatchIndex ?? 0) + 1), delay);
    }
  }, [
    isHost, freshStart, restored, phase, setGameTimeout, advanceToRound2,
    advanceToMatchups, finishMatch, startMatch
  ]);

  const handleMessage = (data: unknown) => {
    const envelope = data as Envelope;

    // --- Host-only reactions: react to player intents, own the canonical state ---
    if (isHost) {
      if (envelope.type === 'debug-host-action') {
        const payload = envelope.payload as { action: string; [key: string]: unknown };
        handleDebugHostAction(payload.action, payload);
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
        hostReceiveVote(fromId, payload.matchIndex, payload.side, payload.final);
      }
    }

    // --- Player-facing reactions: everyone (including host-as-player) follows the broadcasts ---
    if (envelope.type === 'debug-timer-update') {
      const payload = envelope.payload as { endTimestamp: number | null; phase: MemoRandomPhase };
      if (payload.endTimestamp === null) {
        setIsTimerPaused(true);
        if (payload.phase === 'round1') setRound1EndTimestamp(null);
        else if (payload.phase === 'round2') setRound2EndTimestamp(null);
        else if (payload.phase === 'matchup' && currentMatchup) {
          setCurrentMatchup(prev => prev ? { ...prev, endTimestamp: null } : null);
        }
      } else {
        setIsTimerPaused(false);
        if (payload.phase === 'round1') setRound1EndTimestamp(payload.endTimestamp);
        else if (payload.phase === 'round2') setRound2EndTimestamp(payload.endTimestamp);
        else if (payload.phase === 'matchup' && currentMatchup) {
          setCurrentMatchup(prev => prev ? { ...prev, endTimestamp: payload.endTimestamp } : null);
        }
      }
    } else if (envelope.type === 'round1-start') {
      const payload = envelope.payload as Round1StartPayload;
      round1SubmittedRef.current = false;
      round1AckedRef.current = false;
      round1LibraryRef.current = null;
      setMyLibrary(emptyLibrary());
      setRound1EndTimestamp(payload.endTimestamp);
      setPhase('round1');
    } else if (envelope.type === 'word-library-ack') {
      if (envelope.playerId !== playerId) return;
      round1AckedRef.current = true;
    } else if (envelope.type === 'round2-assignments') {
      if (phaseRef.current === 'round2' || phaseRef.current === 'round2-waiting' || phaseRef.current === 'matchup' || phaseRef.current === 'matchup-results' || phaseRef.current === 'winner') return;
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
      setTemplate(mine.template);
      setMySheetAnswers({});
      setRound2EndTimestamp(payload.endTimestamp);
      setPhase('round2');
    } else if (envelope.type === 'sheet-submit-ack') {
      if (envelope.playerId !== playerId) return;
      round2AckedRef.current = true;
    } else if (envelope.type === 'vote-submit-ack') {
      if (envelope.playerId !== playerId) return;
      const payload = envelope.payload as VoteSubmitAckPayload;
      if (currentMatchup && payload.matchIndex === currentMatchup.matchIndex) {
        matchVoteAckedRef.current = true;
      }
    } else if (envelope.type === 'matchup-start') {
      const payload = envelope.payload as MatchupStartPayload;
      setCurrentMatchup(payload);
      setMatchResult(null);
      setMyMatchVote(null);
      setMatchVoteLocked(false);
      matchVoteSubmittedRef.current = false;
      matchVoteAckedRef.current = false;
      setSeenSheets((prev) => ({ ...prev, [payload.left.playerId]: payload.left, [payload.right.playerId]: payload.right }));
      setPhase('matchup');
    } else if (envelope.type === 'match-result') {
      const payload = envelope.payload as MatchResultPayload;
      setMatchResult(payload);
      setPhase('matchup-results');
    } else if (envelope.type === 'winner-announced') {
      const payload = envelope.payload as WinnerPayload;
      setWinnerInfo(payload);
      setPhase('winner');
    }
  };

  // Re-register every render (not just on mount) so GameShell always calls the freshest closure.
  useEffect(() => {
    onRegisterMessageHandler(handleMessage);
  });

  const hasMountedRef = useRef(false);
  useEffect(() => {
    // One-time reaction to how this component just mounted, not a synced value — an effect is still correct here.
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;
    if (isHost && freshStart) beginRound1();
  }, [isHost, freshStart, beginRound1]);

  // Shared by the timer-expiry and maxed-out-every-category triggers below.
  const submitRound1Library = useCallback(() => {
    if (round1SubmittedRef.current) return;
    round1SubmittedRef.current = true;
    const library = myLibraryRef.current;
    round1LibraryRef.current = library;
    sendMessage({ type: 'word-library-submit', playerId, timestamp: Date.now(), payload: { library } });
    if (isHost) hostReceiveWordLibrary(playerId, library);
    setPhase('round1-waiting');
  }, [playerId, sendMessage, isHost, hostReceiveWordLibrary]);

  // Round 1 local timer expiry: submit the (already-categorized) library
  // collected so far and wait for the host.
  const round1Countdown = useCountdown(round1EndTimestamp);
  useEffect(() => {
    if (isDisplay) return;
    if (phase === 'round1' && round1Countdown.expired && !round1SubmittedRef.current) {
      submitRound1Library();
    }
  }, [phase, round1Countdown.expired, playerId, sendMessage, isHost, isDisplay, submitRound1Library]);

  // No point waiting out the timer once every category is maxed out — there's nothing left to type.
  useEffect(() => {
    if (isDisplay || phase !== 'round1' || round1SubmittedRef.current) return;
    const maxedOut = CATEGORIES.filter((c) => c !== 'pronoun').every(
      (c) => myLibrary[c].length >= MAX_WORDS_PER_CATEGORY
    );
    if (maxedOut) submitRound1Library();
  }, [phase, myLibrary, isDisplay, submitRound1Library]);

  // Every client's timer expires at once, bursting submissions over ntfy — keep resending until acked or we give up.
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
  const submitRound2Sheet = useCallback((finalAnswers: Record<string, string>) => {
    if (round2SubmittedRef.current) return;
    round2SubmittedRef.current = true;
    round2AnswersRef.current = finalAnswers;
    sendMessage({ type: 'sheet-submit', playerId, timestamp: Date.now(), payload: { answers: finalAnswers } });
    if (isHost) hostReceiveSheetSubmit(playerId, finalAnswers);
    setPhase('round2-waiting');
  }, [playerId, sendMessage, isHost, hostReceiveSheetSubmit]);

  // Round 2 local timer expiry: auto-fill unset blanks, submit, and wait.
  const round2Countdown = useCountdown(round2EndTimestamp);
  useEffect(() => {
    if (isDisplay) return;
    if (phase === 'round2' && round2Countdown.expired && !round2SubmittedRef.current) {
      const tmpl = templateRef.current;
      const library = assignedLibraryRef.current;
      if (!tmpl || !library) return;
      const options = buildDropdownOptions(library, tmpl, rosterRef.current.map((p) => p.name));
      const finalAnswers = { ...mySheetAnswersRef.current };
      for (const blank of tmpl.blanks) {
        if (!finalAnswers[blank.id]) {
          finalAnswers[blank.id] = options[blank.id]?.[0] ?? '';
        }
      }
      submitRound2Sheet(finalAnswers);
    }
  }, [phase, round2Countdown.expired, playerId, sendMessage, isHost, isDisplay, submitRound2Sheet]);

  // Tick timers during countdowns
  const r1Sec = Math.ceil(round1Countdown.msRemaining / 1000);
  useEffect(() => {
    if (phase === 'round1' && r1Sec <= 5 && r1Sec > 0 && !isDisplay) {
      audioManager.playTick();
    }
  }, [phase, r1Sec, isDisplay]);

  const r2Sec = Math.ceil(round2Countdown.msRemaining / 1000);
  useEffect(() => {
    if (phase === 'round2' && r2Sec <= 5 && r2Sec > 0 && !isDisplay) {
      audioManager.playTick();
    }
  }, [phase, r2Sec, isDisplay]);

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

  const addWord = (category: Category, word: string) => {
    audioManager.playClick();
    setMyLibrary((prev) => ({ ...prev, [category]: [...prev[category], word] }));
  };
  const setAnswer = (blankId: string, value: string) =>
    setMySheetAnswers((prev) => ({ ...prev, [blankId]: value }));
  const submitMySheet = () => {
    audioManager.playClick();
    submitRound2Sheet(mySheetAnswers);
  };

  // Tapping the same side again deselects it. Provisional (final: false) — counts toward the timer tally only.
  const castMatchVote = (side: MatchupSide) => {
    if (matchVoteSubmittedRef.current || !currentMatchup) return;
    audioManager.playClick();
    const nextVote = myMatchVote === side ? null : side;
    setMyMatchVote(nextVote);
    sendMessage({ type: 'vote-submit', playerId, timestamp: Date.now(), payload: { matchIndex: currentMatchup.matchIndex, side: nextVote, final: false } });
    if (isHost) hostReceiveVote(playerId, currentMatchup.matchIndex, nextVote, false);
  };

  const submitMatchVote = () => {
    if (matchVoteSubmittedRef.current || !myMatchVote || !currentMatchup) return;
    audioManager.playClick();
    matchVoteSubmittedRef.current = true;
    sendMessage({ type: 'vote-submit', playerId, timestamp: Date.now(), payload: { matchIndex: currentMatchup.matchIndex, side: myMatchVote, final: true } });
    if (isHost) hostReceiveVote(playerId, currentMatchup.matchIndex, myMatchVote, true);
    setMatchVoteLocked(true);
  };

  // Same rationale as the round1/round2 retries above: resend the final vote until the host acks it or we give up.
  useEffect(() => {
    if (isHost || !matchVoteLocked || !currentMatchup || !myMatchVote) return;
    const matchIndex = currentMatchup.matchIndex;
    const side = myMatchVote;
    let attempts = 0;
    const trySend = () => {
      if (matchVoteAckedRef.current) {
        clearInterval(interval);
        return;
      }
      sendMessage({ type: 'vote-submit', playerId, timestamp: Date.now(), payload: { matchIndex, side, final: true } });
      attempts++;
      if (attempts >= SUBMIT_MAX_ATTEMPTS) clearInterval(interval);
    };
    const interval = setInterval(trySend, SUBMIT_RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [matchVoteLocked, currentMatchup, myMatchVote, isHost, playerId, sendMessage]);

  const playAgain = () => {
    sendMessage({ type: 'play-again', timestamp: Date.now(), payload: {} });
  };

  // Host-only display stat (wordLibrariesRef is only ever populated for the host).
  const [round1TotalWords, setRound1TotalWords] = useState(0);
  useEffect(() => {
    const total = Array.from(wordLibrariesRef.current.values()).reduce(
      (sum, library) => sum + CATEGORIES.reduce((s, c) => s + library[c].length, 0),
      0
    );
    setRound1TotalWords(total);
  }, [round1Progress, wordLibrariesRef]);

  return (
    <>
      <button
        onClick={handleToggleMute}
        className="fixed top-4 right-4 z-[9999] flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/45 px-3.5 py-1.5 text-xs font-semibold tracking-wider text-white shadow-xl backdrop-blur-md transition-all hover:scale-105 hover:bg-black/60"
        title={muted ? 'Unmute sound effects' : 'Mute sound effects'}
      >
        <span>{muted ? '🔇 MUTED' : '🔊 OFFICE SOUNDS'}</span>
      </button>
      {phase === 'starting' && (
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brodin-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}

      {phase === 'round1' && round1EndTimestamp && (
        isDisplay ? (
          <div className="flex-1 w-full flex flex-col items-center justify-center text-center space-y-6">
            <p className="text-sm uppercase tracking-widest text-gray-400">Round 1: Type your words!</p>
            <p className="text-2xl font-display font-bold text-brodin-accent">
              {Math.ceil(round1Countdown.msRemaining / 1000)}s
            </p>
            <p className="text-[12rem] leading-none font-display font-extrabold text-brodin-accent">
              {round1TotalWords}
            </p>
            <p className="text-3xl font-display font-bold text-gray-200">
              words collected for research so far
            </p>
          </div>
        ) : (
          <Round1Typing endTimestamp={round1EndTimestamp} library={myLibrary} onAddWord={addWord} />
        )
      )}

      {phase === 'round1-waiting' && (
        <div className="text-center space-y-4">
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
          roster={roster}
          answers={mySheetAnswers}
          onAnswerChange={setAnswer}
          onSubmit={submitMySheet}
        />
      )}

      {phase === 'round2-waiting' && (
        <div className="text-center space-y-4">
          <p className="text-sm text-gray-400">
            Waiting for other players...{isHost && ` (${round2Progress}/${round1Progress} submitted)`}
          </p>
        </div>
      )}

      {phase === 'round2-dropped' && (
        <div className="text-center space-y-4">
          <p className="text-sm text-gray-400">
            {isDisplay
              ? `Round 2 in progress... (${round2Progress}/${round1Progress} submitted)`
              : 'Your round 1 submission arrived too late, so you sat out round 2. Waiting for results...'}
          </p>
        </div>
      )}

      {phase === 'matchup' && currentMatchup && (
        <MatchupScreen
          matchup={currentMatchup}
          myPlayerId={playerId}
          myVote={myMatchVote}
          locked={matchVoteLocked}
          readOnly={isDisplay}
          onVote={castMatchVote}
          onSubmit={submitMatchVote}
        />
      )}

      {phase === 'matchup-results' && matchResult && (
        <MatchResultScreen result={matchResult} />
      )}

      {phase === 'winner' && winnerInfo && (
        <WinnerScreen
          sheets={seenSheets}
          winnerPlayerIds={winnerInfo.winnerPlayerIds}
          scores={winnerInfo.scores}
          isHost={isHost}
          isConnected={isConnected}
          onPlayAgain={playAgain}
          onEndSession={onQuit}
          onDisconnect={onQuit}
        />
      )}
    </>
  );
}
