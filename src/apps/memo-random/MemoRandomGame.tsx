import { useEffect, useRef, useState } from 'react';
import { useCountdown } from '../../shared/hooks/useCountdown';
import { loadDictionary } from './utils/dictionary';
import { assignLibraries } from './utils/derangement';
import { buildDropdownOptions } from './utils/fallbackMerge';
import { buildPairings, buildMatchupsFromPairings, getTemplateById, type Matchup, type MatchPairing } from './utils/matchmaking';
import { saveSnapshot, loadSnapshot, gameSnapshotKey } from '../../shared/utils/sessionSnapshot';
import {
  ROUND1_DURATION_MS,
  ROUND2_DURATION_MS,
  VOTE_DURATION_MS,
  RESULTS_DURATION_MS,
  MATCH_WIN_BONUS,
  GRACE_PERIOD_MS,
  SUBMIT_RETRY_INTERVAL_MS,
  SUBMIT_MAX_ATTEMPTS,
  MAX_WORDS_PER_CATEGORY,
} from './constants';
import { emptyLibrary, CATEGORIES } from './types';
import type {
  Category,
  MemoRandomPhase,
  MadLibTemplate,
  MatchResultPayload,
  MatchupSide,
  MatchupStartPayload,
  PlayerAssignment,
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
import QuitConfirmModal from '../../shared/components/QuitConfirmModal';

// Host-only bookkeeping, persisted across refresh. Maps/Sets as arrays since sessionStorage only holds JSON.
interface HostSnapshot {
  wordLibraries: [string, WordLibrary][];
  sheets: [string, PlayerSheetResult][];
  assignments: Record<string, PlayerAssignment>;
  pairings: MatchPairing[];
  matchups: Matchup[];
  currentMatchIndex: number;
  matchVotes: [string, MatchupSide][];
  matchVotedPlayers: string[];
  scores: Record<string, number>;
  round2Started: boolean;
  matchupsStarted: boolean;
  winnerAnnounced: boolean;
  matchAdvanced: boolean;
  expectedVoters: number;
}

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

export default function MemoRandomGame({ code, playerId, isHost, roster, isConnected, sendMessage, isDisplay, freshStart, onRegisterMessageHandler, onQuit }: GamePlayProps) {
  const restored = freshStart ? null : loadSnapshot<MemoRandomSnapshot>(gameSnapshotKey(code));

  const [phase, setPhase] = useState<MemoRandomPhase>(restored?.gamePhase ?? 'starting');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
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
  const wordLibrariesRef = useRef(new Map<string, WordLibrary>(restored?.host?.wordLibraries ?? []));
  const sheetsRef = useRef(new Map<string, PlayerSheetResult>(restored?.host?.sheets ?? []));
  const assignmentsRef = useRef<Record<string, PlayerAssignment>>(restored?.host?.assignments ?? {});
  const pairingsRef = useRef<MatchPairing[]>(restored?.host?.pairings ?? []);
  const matchupsRef = useRef<Matchup[]>(restored?.host?.matchups ?? []);
  const currentMatchIndexRef = useRef(restored?.host?.currentMatchIndex ?? 0);
  const matchVotesRef = useRef(new Map<string, MatchupSide>(restored?.host?.matchVotes ?? []));
  const matchVotedPlayersRef = useRef(new Set<string>(restored?.host?.matchVotedPlayers ?? []));
  const matchAdvancedRef = useRef(restored?.host?.matchAdvanced ?? false);
  const expectedVotersRef = useRef(restored?.host?.expectedVoters ?? 0);
  const scoresRef = useRef<Record<string, number>>(restored?.host?.scores ?? {});
  const round2StartedRef = useRef(restored?.host?.round2Started ?? false);
  const matchupsStartedRef = useRef(restored?.host?.matchupsStarted ?? false);
  const winnerAnnouncedRef = useRef(restored?.host?.winnerAnnounced ?? false);
  const round1SubmittedRef = useRef(restored?.round1Submitted ?? false);
  const round2SubmittedRef = useRef(restored?.round2Submitted ?? false);
  const matchVoteSubmittedRef = useRef(restored?.matchVoteSubmitted ?? false);

  // Acked flags deliberately NOT restored — resending an already-acked submission is harmless, skipping a needed one isn't.
  const round1LibraryRef = useRef<WordLibrary | null>(restored?.round1Library ?? null);
  const round1AckedRef = useRef(false);
  const round2AnswersRef = useRef<Record<string, string> | null>(restored?.round2Answers ?? null);
  const round2AckedRef = useRef(false);
  const matchVoteAckedRef = useRef(false);

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
    winnerInfo, round1Progress, round2Progress,
  ]);

  // A host refresh kills every pending setTimeout fallback — re-arm whichever one applies, timed off the
  // persisted absolute end-timestamp so it still fires at the original real-world moment.
  useEffect(() => {
    if (!isHost || freshStart || !restored) return;
    const now = Date.now();
    if (phase === 'round1' || phase === 'round1-waiting') {
      const delay = Math.max(0, (restored.round1EndTimestamp ?? now) + GRACE_PERIOD_MS - now);
      setTimeout(() => advanceToRound2(), delay);
    } else if (phase === 'round2' || phase === 'round2-waiting') {
      const delay = Math.max(0, (restored.round2EndTimestamp ?? now) + GRACE_PERIOD_MS - now);
      setTimeout(() => advanceToMatchups(), delay);
    } else if (phase === 'matchup') {
      const delay = Math.max(0, (restored.currentMatchup?.endTimestamp ?? now) + GRACE_PERIOD_MS - now);
      setTimeout(() => finishMatch(restored.host?.currentMatchIndex ?? 0), delay);
    } else if (phase === 'matchup-results') {
      const delay = Math.max(0, (restored.matchResult?.resultsEndTimestamp ?? now) - now);
      setTimeout(() => startMatch((restored.host?.currentMatchIndex ?? 0) + 1), delay);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMessage = (data: unknown) => {
    const envelope = data as Envelope;

    // --- Host-only reactions: react to player intents, own the canonical state ---
    if (isHost) {
      if (envelope.type === 'word-library-submit') {
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
    if (envelope.type === 'round1-start') {
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

  // Called both from handleMessage and directly for the host's own actions (its own broadcasts
  // aren't guaranteed to echo back). Map.set() makes a duplicate call for the same player harmless.
  function hostReceiveWordLibrary(fromId: string, library: WordLibrary) {
    // Gate on this ref, not phaseRef — the host's own phase flips to 'round1-waiting' as soon as its
    // own timer fires, well before other players' submissions arrive over the network.
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
    if (matchupsStartedRef.current) return;
    const assignment = assignmentsRef.current[fromId];
    if (!assignment) return;
    const playerName = rosterRef.current.find((p) => p.id === fromId)?.name ?? 'Unknown';
    sheetsRef.current.set(fromId, {
      playerId: fromId,
      playerName,
      templateId: assignment.template.id,
      answers,
      contributors: assignment.contributorNames,
    });
    setRound2Progress(sheetsRef.current.size);
    sendMessage({ type: 'sheet-submit-ack', playerId: fromId, timestamp: Date.now(), payload: {} });
    const expectedCount = Object.keys(assignmentsRef.current).length;
    if (sheetsRef.current.size >= expectedCount) {
      advanceToMatchups();
    }
  }

  // A vote for a stale matchIndex (already scored and moved past) is a no-op — still acked
  // (tagged with that matchIndex) so a late-arriving retry doesn't just keep resending forever.
  function hostReceiveVote(fromId: string, matchIndex: number, side: MatchupSide | null, final: boolean) {
    if (final) {
      sendMessage({ type: 'vote-submit-ack', playerId: fromId, timestamp: Date.now(), payload: { matchIndex } });
    }
    if (matchIndex !== currentMatchIndexRef.current || matchAdvancedRef.current) return;
    if (side) {
      matchVotesRef.current.set(fromId, side);
    } else {
      matchVotesRef.current.delete(fromId);
    }
    if (final) {
      matchVotedPlayersRef.current.add(fromId);
      if (matchVotedPlayersRef.current.size >= expectedVotersRef.current) {
        finishMatch(matchIndex);
      }
    }
  }

  // Decides up front which other players' words feed each dropdown, and which pairs (sharing a
  // template, so they're comparable) will later be voted on head-to-head.
  function advanceToRound2() {
    if (round2StartedRef.current) return;
    round2StartedRef.current = true;
    const playerNames = new Map(rosterRef.current.map((p) => [p.id, p.name]));
    const wordSourceAssignments = assignLibraries(wordLibrariesRef.current, playerNames);
    const pairings = buildPairings(Array.from(wordLibrariesRef.current.keys()));
    pairingsRef.current = pairings;

    const assignments: Record<string, PlayerAssignment> = {};
    for (const pairing of pairings) {
      const template = getTemplateById(pairing.templateId);
      for (const pid of pairing.playerIds) {
        const source = wordSourceAssignments[pid];
        if (source) assignments[pid] = { ...source, template };
      }
    }
    assignmentsRef.current = assignments;

    const endTimestamp = Date.now() + ROUND2_DURATION_MS;
    sendMessage({
      type: 'round2-assignments',
      timestamp: Date.now(),
      payload: { assignments, endTimestamp },
    });
    setTimeout(() => advanceToMatchups(), ROUND2_DURATION_MS + GRACE_PERIOD_MS);
  }

  // A pairing whose partner never submitted round 2 gets a bot opponent instead.
  function advanceToMatchups() {
    if (matchupsStartedRef.current) return;
    matchupsStartedRef.current = true;
    matchupsRef.current = buildMatchupsFromPairings(pairingsRef.current, sheetsRef.current);
    scoresRef.current = {};
    for (const sheet of sheetsRef.current.values()) scoresRef.current[sheet.playerId] = 0;
    startMatch(0);
  }

  function startMatch(index: number) {
    if (index >= matchupsRef.current.length) {
      advanceToWinner();
      return;
    }
    currentMatchIndexRef.current = index;
    matchAdvancedRef.current = false;
    matchVotesRef.current = new Map();
    matchVotedPlayersRef.current = new Set();
    const { left, right } = matchupsRef.current[index];
    // The authors of the two sheets being judged can't vote in their own matchup.
    expectedVotersRef.current = rosterRef.current.filter(
      (p) => p.id !== left.playerId && p.id !== right.playerId
    ).length;
    const endTimestamp = Date.now() + VOTE_DURATION_MS;
    sendMessage({
      type: 'matchup-start',
      timestamp: Date.now(),
      payload: { matchIndex: index, totalMatches: matchupsRef.current.length, left, right, endTimestamp },
    });
    // Nobody else can vote — resolve the foregone 0-0 tie almost immediately instead of waiting out the clock.
    if (expectedVotersRef.current === 0) {
      setTimeout(() => finishMatch(index), 300);
      return;
    }
    setTimeout(() => finishMatch(index), VOTE_DURATION_MS + GRACE_PERIOD_MS);
  }

  // Called by the grace-period fallback or, early, once everyone's voted — whichever fires first wins.
  function finishMatch(index: number) {
    if (matchAdvancedRef.current || index !== currentMatchIndexRef.current) return;
    matchAdvancedRef.current = true;
    const { left, right } = matchupsRef.current[index];
    let leftVotes = 0;
    let rightVotes = 0;
    matchVotesRef.current.forEach((side) => {
      if (side === 'left') leftVotes++;
      else rightVotes++;
    });
    // Bot sheets aren't real players, so votes/bonuses for them are counted
    // in the result tally but never credited to anyone's score.
    if (!left.isBot) scoresRef.current[left.playerId] = (scoresRef.current[left.playerId] ?? 0) + leftVotes;
    if (!right.isBot) scoresRef.current[right.playerId] = (scoresRef.current[right.playerId] ?? 0) + rightVotes;
    if (leftVotes !== rightVotes) {
      const matchWinner = leftVotes > rightVotes ? left : right;
      if (!matchWinner.isBot) {
        scoresRef.current[matchWinner.playerId] = (scoresRef.current[matchWinner.playerId] ?? 0) + MATCH_WIN_BONUS;
      }
    }
    const resultsEndTimestamp = Date.now() + RESULTS_DURATION_MS;
    sendMessage({
      type: 'match-result',
      timestamp: Date.now(),
      payload: {
        matchIndex: index,
        totalMatches: matchupsRef.current.length,
        left,
        right,
        leftVotes,
        rightVotes,
        scores: { ...scoresRef.current },
        resultsEndTimestamp,
      },
    });
    // Plain fixed-length results display — no "everyone's ready" fast path, no added grace period.
    setTimeout(() => startMatch(index + 1), RESULTS_DURATION_MS);
  }

  function advanceToWinner() {
    if (winnerAnnouncedRef.current) return;
    winnerAnnouncedRef.current = true;
    const scores = scoresRef.current;
    const maxScore = Math.max(0, ...Object.values(scores));
    const winnerPlayerIds = Object.keys(scores).filter((id) => scores[id] === maxScore);
    sendMessage({ type: 'winner-announced', timestamp: Date.now(), payload: { winnerPlayerIds, scores } });
  }

  // Host-only, on a fresh start. Relies on this broadcast echoing back to
  // itself like every other player's, rather than setting local state directly.
  function beginRound1() {
    wordLibrariesRef.current = new Map();
    sheetsRef.current = new Map();
    pairingsRef.current = [];
    matchupsRef.current = [];
    currentMatchIndexRef.current = 0;
    matchVotesRef.current = new Map();
    matchVotedPlayersRef.current = new Set();
    scoresRef.current = {};
    setSeenSheets({});
    setRound1Progress(0);
    setRound2Progress(0);
    const endTimestamp = Date.now() + ROUND1_DURATION_MS;
    sendMessage({ type: 'round1-start', timestamp: Date.now(), payload: { endTimestamp } });
    setTimeout(() => advanceToRound2(), ROUND1_DURATION_MS + GRACE_PERIOD_MS);
  }

  useEffect(() => {
    // One-time reaction to how this component just mounted, not a synced value — an effect is still correct here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isHost && freshStart) beginRound1();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared by the timer-expiry and maxed-out-every-category triggers below.
  function submitRound1Library() {
    if (round1SubmittedRef.current) return;
    round1SubmittedRef.current = true;
    const library = myLibraryRef.current;
    round1LibraryRef.current = library;
    sendMessage({ type: 'word-library-submit', playerId, timestamp: Date.now(), payload: { library } });
    if (isHost) hostReceiveWordLibrary(playerId, library);
    setPhase('round1-waiting');
  }

  // Round 1 local timer expiry: submit the (already-categorized) library
  // collected so far and wait for the host.
  const round1Countdown = useCountdown(round1EndTimestamp);
  useEffect(() => {
    if (isDisplay) return;
    if (phase === 'round1' && round1Countdown.expired && !round1SubmittedRef.current) {
      submitRound1Library();
    }
  }, [phase, round1Countdown.expired, playerId, sendMessage, isHost, isDisplay]);

  // No point waiting out the timer once every category is maxed out — there's nothing left to type.
  useEffect(() => {
    if (isDisplay || phase !== 'round1' || round1SubmittedRef.current) return;
    const maxedOut = CATEGORIES.filter((c) => c !== 'pronoun').every(
      (c) => myLibrary[c].length >= MAX_WORDS_PER_CATEGORY
    );
    if (maxedOut) submitRound1Library();
  }, [phase, myLibrary, isDisplay]);

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
  }, [phase, round2Countdown.expired, playerId, sendMessage, isHost, isDisplay]);

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

  const addWord = (category: Category, word: string) =>
    setMyLibrary((prev) => ({ ...prev, [category]: [...prev[category], word] }));
  const setAnswer = (blankId: string, value: string) =>
    setMySheetAnswers((prev) => ({ ...prev, [blankId]: value }));
  const submitMySheet = () => submitRound2Sheet(mySheetAnswers);

  // Tapping the same side again deselects it. Provisional (final: false) — counts toward the timer tally only.
  const castMatchVote = (side: MatchupSide) => {
    if (matchVoteSubmittedRef.current || !currentMatchup) return;
    const nextVote = myMatchVote === side ? null : side;
    setMyMatchVote(nextVote);
    sendMessage({ type: 'vote-submit', playerId, timestamp: Date.now(), payload: { matchIndex: currentMatchup.matchIndex, side: nextVote, final: false } });
    if (isHost) hostReceiveVote(playerId, currentMatchup.matchIndex, nextVote, false);
  };

  const submitMatchVote = () => {
    if (matchVoteSubmittedRef.current || !myMatchVote || !currentMatchup) return;
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

  // Host-only (wordLibrariesRef is only ever populated for the host); re-derived each render off
  // the same ref round1Progress already tracks, so no extra state/snapshot field is needed.
  const round1TotalWords = Array.from(wordLibrariesRef.current.values()).reduce(
    (sum, library) => sum + CATEGORIES.reduce((s, c) => s + library[c].length, 0),
    0
  );

  return (
    <>
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
          <button onClick={() => setShowLeaveConfirm(true)} className="text-sm text-gray-500 hover:text-red-400 underline">
            Leave game
          </button>
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
            Waiting for other players...{isHost && ` (${round2Progress}/${Object.keys(assignmentsRef.current).length} submitted)`}
          </p>
          <button onClick={() => setShowLeaveConfirm(true)} className="text-sm text-gray-500 hover:text-red-400 underline">
            Leave game
          </button>
        </div>
      )}

      {phase === 'round2-dropped' && (
        <div className="text-center space-y-4">
          <p className="text-sm text-gray-400">
            {isDisplay
              ? `Round 2 in progress... (${round2Progress}/${Object.keys(assignmentsRef.current).length} submitted)`
              : 'Your round 1 submission arrived too late, so you sat out round 2. Waiting for results...'}
          </p>
          <button onClick={() => setShowLeaveConfirm(true)} className="text-sm text-gray-500 hover:text-red-400 underline">
            Leave game
          </button>
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

      {showLeaveConfirm && (
        <QuitConfirmModal
          playerCount={Math.max(0, roster.length - 1)}
          onConfirm={() => {
            setShowLeaveConfirm(false);
            onQuit();
          }}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}
    </>
  );
}
