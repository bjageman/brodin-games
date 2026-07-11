import { useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { PlayerInfo } from '../../shared/types';
import { assignLibraries } from './utils/derangement';
import { buildPairings, buildMatchupsFromPairings, getTemplateById, type Matchup, type MatchPairing } from './utils/matchmaking';
import {
  ROUND1_DURATION_MS,
  ROUND2_DURATION_MS,
  VOTE_DURATION_MS,
  RESULTS_DURATION_MS,
  MATCH_WIN_BONUS,
  GRACE_PERIOD_MS,
} from './constants';
import type { MatchupSide, PlayerAssignment, PlayerSheetResult, WordLibrary } from './types';

// Serialized host bookkeeping for refresh-resume (a mid-game host reload).
export interface HostSnapshot {
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

interface MemoHostCtx {
  restored: HostSnapshot | undefined;
  rosterRef: MutableRefObject<PlayerInfo[]>;
  sendMessage: (payload: unknown) => Promise<void>;
  setGameTimeout: (callback: () => void, delayMs: number) => void;
  setRound1Progress: (n: number) => void;
  setRound2Progress: (n: number) => void;
  setSeenSheets: Dispatch<SetStateAction<Record<string, PlayerSheetResult>>>;
}

// The host's authoritative game engine: round orchestration, matchmaking, and
// scoring. Owns the host-only bookkeeping refs and drives the game by
// broadcasting — its own display updates when those broadcasts echo back, same
// as every other player's. Extracted from the game component to keep it under
// size; the function bodies are unchanged.
export function useMemoRandomHost({
  restored, rosterRef, sendMessage, setGameTimeout,
  setRound1Progress, setRound2Progress, setSeenSheets,
}: MemoHostCtx) {
  const wordLibrariesRef = useRef(new Map<string, WordLibrary>(restored?.wordLibraries ?? []));
  const sheetsRef = useRef(new Map<string, PlayerSheetResult>(restored?.sheets ?? []));
  const assignmentsRef = useRef<Record<string, PlayerAssignment>>(restored?.assignments ?? {});
  const pairingsRef = useRef<MatchPairing[]>(restored?.pairings ?? []);
  const matchupsRef = useRef<Matchup[]>(restored?.matchups ?? []);
  const currentMatchIndexRef = useRef(restored?.currentMatchIndex ?? 0);
  const matchVotesRef = useRef(new Map<string, MatchupSide>(restored?.matchVotes ?? []));
  const matchVotedPlayersRef = useRef(new Set<string>(restored?.matchVotedPlayers ?? []));
  const matchAdvancedRef = useRef(restored?.matchAdvanced ?? false);
  const expectedVotersRef = useRef(restored?.expectedVoters ?? 0);
  const scoresRef = useRef<Record<string, number>>(restored?.scores ?? {});
  const round2StartedRef = useRef(restored?.round2Started ?? false);
  const matchupsStartedRef = useRef(restored?.matchupsStarted ?? false);
  const winnerAnnouncedRef = useRef(restored?.winnerAnnounced ?? false);

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
    setGameTimeout(() => advanceToMatchups(), ROUND2_DURATION_MS + GRACE_PERIOD_MS);
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
      setGameTimeout(() => finishMatch(index), 300);
      return;
    }
    setGameTimeout(() => finishMatch(index), VOTE_DURATION_MS + GRACE_PERIOD_MS);
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
    setGameTimeout(() => startMatch(index + 1), RESULTS_DURATION_MS);
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
    setGameTimeout(() => advanceToRound2(), ROUND1_DURATION_MS + GRACE_PERIOD_MS);
  }

  return {
    wordLibrariesRef, sheetsRef, assignmentsRef, pairingsRef, matchupsRef, currentMatchIndexRef,
    matchVotesRef, matchVotedPlayersRef, matchAdvancedRef, expectedVotersRef, scoresRef,
    round2StartedRef, matchupsStartedRef, winnerAnnouncedRef,
    hostReceiveWordLibrary, hostReceiveSheetSubmit, hostReceiveVote,
    advanceToRound2, advanceToMatchups, startMatch, finishMatch, advanceToWinner, beginRound1,
  };
}
