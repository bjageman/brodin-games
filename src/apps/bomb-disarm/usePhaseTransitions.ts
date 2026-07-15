import { useEffect, useCallback } from 'react';
import type { PlayerInfo } from '../../shared/types';
import {
  MEMORIZE_DURATION_MS, ROLE_REVEAL_DURATION_MS, STATE_REQUEST_MAX_ATTEMPTS, STATE_REQUEST_RETRY_INTERVAL_MS,
} from './constants';
import { assignRoles } from './roles';
import { buildDeck, dealHands, shuffle } from './deck';
import { specialRolesForDeal, specialsForDeal } from './settings';
import type { BombPhase, GameState } from './types';

interface PhaseTransitionsDeps {
  code: string;
  playerId: string;
  roster: PlayerInfo[];
  isHost: boolean;
  freshStart: boolean;
  phase: BombPhase;
  hands: GameState['hands'];
  activePlayerId: string;
  roleRevealEndTimestamp: number | null;
  roleExpired: boolean;
  memorizeEndTimestamp: number | null;
  memoExpired: boolean;
  emptyState: GameState;
  sendMessage: (payload: unknown) => Promise<void>;
  setState: (next: GameState) => void;
  patch: (fields: Partial<GameState>) => void;
}

// The clock-driven phase changes (deal -> role reveal -> memorize -> table) and
// the client-side recovery poll for a missed initial broadcast. Split out from
// the main component because none of it touches the reducers that resolve a
// pick — it only ever calls into them through `patch`.
export function usePhaseTransitions(deps: PhaseTransitionsDeps) {
  const {
    code, playerId, roster, isHost, freshStart, phase, hands, activePlayerId,
    roleRevealEndTimestamp, roleExpired, memorizeEndTimestamp, memoExpired,
    emptyState, sendMessage, setState, patch,
  } = deps;

  const dealGame = useCallback((): GameState => {
    const ids = roster.map((p) => p.id);
    const { roles: nextRoles, specialRoles: nextSpecialRoles, leftoverRole: nextLeftoverRole } = assignRoles(
      ids,
      specialRolesForDeal(code),
    );
    const folkHeroInPlay = Object.values(nextSpecialRoles).includes('folk-hero');
    const deck = buildDeck(roster.length, specialsForDeal(code, roster.length), folkHeroInPlay);

    return {
      ...emptyState,
      phase: 'role-reveal',
      roles: nextRoles,
      specialRoles: nextSpecialRoles,
      leftoverRole: nextLeftoverRole,
      hands: dealHands(ids, deck),
      roleRevealEndTimestamp: Date.now() + ROLE_REVEAL_DURATION_MS,
    };
  }, [code, roster, emptyState]);

  const goToMemorize = useCallback(() => {
    patch({ phase: 'memorize', roleRevealEndTimestamp: null, memorizeEndTimestamp: Date.now() + MEMORIZE_DURATION_MS });
  }, [patch]);

  const goToTable = useCallback(() => {
    // Flip every hand face-down and shuffle its order so the 60s of study can't
    // be turned into "the bomb is the third card".
    const shuffledHands: GameState['hands'] = {};
    Object.entries(hands).forEach(([pid, hand]) => { shuffledHands[pid] = shuffle(hand); });
    // Rounds 2 and 3 open with whoever's card was flipped last; round 1 is random.
    const carried = roster.some((p) => p.id === activePlayerId) ? activePlayerId : '';
    const firstPicker = carried || roster[Math.floor(Math.random() * roster.length)]?.id || '';
    patch({ phase: 'table', hands: shuffledHands, activePlayerId: firstPicker, memorizeEndTimestamp: null });
  }, [hands, roster, activePlayerId, patch]);

  // ---- Host: initialize the game on a fresh start ----
  useEffect(() => {
    if (isHost && phase === 'starting') {
      if (roster.length === 0) return;
      const s = dealGame();
      setState(s);
      sendMessage({ type: 'bomb-state-update', timestamp: Date.now(), payload: s });
    }
  }, [isHost, freshStart, roster.length, dealGame, phase, sendMessage, setState]);

  // ---- Host transition: Role Reveal -> Memorize ----
  useEffect(() => {
    if (isHost && phase === 'role-reveal' && roleRevealEndTimestamp && roleExpired) {
      goToMemorize();
    }
  }, [isHost, phase, roleRevealEndTimestamp, roleExpired, goToMemorize]);

  // ---- Host transition: Memorize -> Table ----
  useEffect(() => {
    if (isHost && phase === 'memorize' && memorizeEndTimestamp && memoExpired) {
      goToTable();
    }
  }, [isHost, phase, memorizeEndTimestamp, memoExpired, goToTable]);

  // ---- Client: recover from a missed initial broadcast (mirrors fake-it) ----
  useEffect(() => {
    if (isHost || phase !== 'starting') return;
    let attempts = 0;
    const trySend = () => {
      sendMessage({ type: 'bomb-request-state', playerId, timestamp: Date.now(), payload: {} });
      attempts++;
      if (attempts >= STATE_REQUEST_MAX_ATTEMPTS) clearInterval(interval);
    };
    trySend();
    const interval = setInterval(trySend, STATE_REQUEST_RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isHost, phase, playerId, sendMessage]);

  return { goToMemorize, goToTable };
}
