import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useCountdown } from '../../shared/hooks/useCountdown';
import { loadSnapshot, saveSnapshot, gameSnapshotKey } from '../../shared/utils/sessionSnapshot';
import type { Envelope } from '../../shared/types';
import type { GamePlayProps } from '../../shared/GameShell';
import { DEBUG_MODE } from '../../shared/constants';
import { type DebugAction } from '../../shared/components/DebugWidget';
import type { BombPhase, Card, CardType, GameState, LastReveal, Role, Winner } from './types';
import {
  CARDS_PER_PLAYER,
  MEMORIZE_DURATION_MS,
  ROLE_REVEAL_DURATION_MS,
  RESULT_REVEAL_DELAY_MS,
  ROUNDS,
  WIRE_WIN_THRESHOLD,
  STATE_REQUEST_RETRY_INTERVAL_MS,
  STATE_REQUEST_MAX_ATTEMPTS,
  deckCompositionFor,
  rebelCountFor,
} from './constants';
import LandscapeStage from './components/LandscapeStage';
import { RoleReveal, MemorizeView, TableView, ResultsView } from './components/BombViews';

interface BombSnapshot {
  bomb: GameState;
}

const CONFETTI_COLORS = ['#f9749f', '#03d1b9', '#facc15'];

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function BombDisarmGame({
  code,
  playerId,
  isHost,
  isDisplay,
  roster,
  sendMessage,
  freshStart,
  onRegisterMessageHandler,
  onQuit,
  onRegisterDebugActions,
}: GamePlayProps) {
  const restored = freshStart ? null : loadSnapshot<BombSnapshot>(gameSnapshotKey(code))?.bomb ?? null;

  const [phase, setPhase] = useState<BombPhase>(restored?.phase ?? 'starting');
  const [roles, setRoles] = useState<Record<string, Role>>(restored?.roles ?? {});
  const [hands, setHands] = useState<Record<string, Card[]>>(restored?.hands ?? {});
  const [activePlayerId, setActivePlayerId] = useState<string>(restored?.activePlayerId ?? '');
  const [wiresRevealed, setWiresRevealed] = useState<number>(restored?.wiresRevealed ?? 0);
  const [turn, setTurn] = useState<number>(restored?.turn ?? 0);
  const [roleRevealEndTimestamp, setRoleRevealEndTimestamp] = useState<number | null>(restored?.roleRevealEndTimestamp ?? null);
  const [memorizeEndTimestamp, setMemorizeEndTimestamp] = useState<number | null>(restored?.memorizeEndTimestamp ?? null);
  const [winner, setWinner] = useState<Winner | null>(restored?.winner ?? null);
  const [lastReveal, setLastReveal] = useState<LastReveal | null>(restored?.lastReveal ?? null);
  const [round, setRound] = useState<number>(restored?.round ?? 1);
  const [revealsThisRound, setRevealsThisRound] = useState<number>(restored?.revealsThisRound ?? 0);
  const [pendingWinner, setPendingWinner] = useState<Winner | null>(restored?.pendingWinner ?? null);

  // ---- Persist a snapshot for refresh-resume ----
  useEffect(() => {
    const bomb: GameState = {
      phase, roles, hands, activePlayerId, wiresRevealed, turn,
      roleRevealEndTimestamp, memorizeEndTimestamp, winner, lastReveal,
      round, revealsThisRound, pendingWinner,
    };
    const current = loadSnapshot<Record<string, unknown>>(gameSnapshotKey(code)) ?? {};
    saveSnapshot(gameSnapshotKey(code), { ...current, bomb });
  }, [code, phase, roles, hands, activePlayerId, wiresRevealed, turn, roleRevealEndTimestamp, memorizeEndTimestamp, winner, lastReveal, round, revealsThisRound, pendingWinner]);

  // ---- Timers ----
  const { msRemaining: roleMs, expired: roleExpired } = useCountdown(roleRevealEndTimestamp);
  const { msRemaining: memoMs, expired: memoExpired } = useCountdown(memorizeEndTimestamp);
  const memoSec = Math.ceil(memoMs / 1000);
  const roleSec = Math.ceil(roleMs / 1000);

  // ---- Host: broadcast full state ----
  function broadcastState(fields: Partial<GameState>) {
    const fullState: GameState = {
      phase, roles, hands, activePlayerId, wiresRevealed, turn,
      roleRevealEndTimestamp, memorizeEndTimestamp, winner, lastReveal,
      round, revealsThisRound, pendingWinner,
      ...fields,
    };
    sendMessage({ type: 'bomb-state-update', timestamp: Date.now(), payload: fullState });
  }

  function publish(state: GameState) {
    applyState(state);
    sendMessage({ type: 'bomb-state-update', timestamp: Date.now(), payload: state });
  }

  // ---- Host: does anyone other than `pid` still have an unrevealed card? ----
  function hasValidTarget(pid: string, handsState: Record<string, Card[]>): boolean {
    return roster.some((p) => p.id !== pid && (handsState[p.id]?.some((c) => !c.revealed) ?? false));
  }

  // ---- Host: reveal a specific card and resolve the turn (shared by taps and debug) ----
  function resolveReveal(ownerId: string, cardIndex: number) {
    const hand = hands[ownerId];
    if (!hand || cardIndex < 0 || cardIndex >= hand.length || hand[cardIndex].revealed) return;
    if (pendingWinner) return;

    const card = hand[cardIndex];
    const nextHands = {
      ...hands,
      [ownerId]: hand.map((c, i) => (i === cardIndex ? { ...c, revealed: true } : c)),
    };
    const ownerName = roster.find((p) => p.id === ownerId)?.name ?? '?';
    const reveal: LastReveal = { targetId: ownerId, targetName: ownerName, cardIndex, type: card.type };
    const nextWires = wiresRevealed + (card.type === 'wire' ? 1 : 0);
    const nextReveals = revealsThisRound + 1;

    const base: GameState = {
      phase: 'table', roles, hands: nextHands, activePlayerId,
      wiresRevealed: nextWires, turn: turn + 1,
      roleRevealEndTimestamp: null, memorizeEndTimestamp: null,
      winner: null, lastReveal: reveal,
      round, revealsThisRound: nextReveals, pendingWinner: null,
    };

    // The deciding card sits face-up for a beat before the verdict lands.
    const finish = (won: Winner) => {
      const held: GameState = { ...base, pendingWinner: won };
      publish(held);
      setTimeout(() => publish({ ...held, phase: 'results', winner: won }), RESULT_REVEAL_DELAY_MS);
    };

    if (card.type === 'explode') return finish('rebels');
    if (nextWires >= WIRE_WIN_THRESHOLD) return finish('peacekeepers');

    if (nextReveals >= roster.length) {
      if (round >= ROUNDS) return finish('rebels');
      return endRound(base, ownerId);
    }

    // Turn passes to the owner of the tapped phone. If they have no one left to
    // tap, hand off to anyone who does; if the whole table is stuck, the bomb
    // was never disarmed, so the rebels take it.
    let nextActive = ownerId;
    if (!hasValidTarget(nextActive, nextHands)) {
      const fallback = roster.find((p) => hasValidTarget(p.id, nextHands));
      if (!fallback) return finish('rebels');
      nextActive = fallback.id;
    }

    publish({ ...base, activePlayerId: nextActive });
  }

  // ---- Host: drop the revealed cards, reshuffle the rest, redeal, re-memorize ----
  function endRound(base: GameState, lastOwnerId: string) {
    const leftovers = shuffle(
      roster.flatMap((p) => (base.hands[p.id] ?? []).filter((c) => !c.revealed))
    );
    const nextHands: Record<string, Card[]> = {};
    roster.forEach((p) => { nextHands[p.id] = []; });
    leftovers.forEach((card, i) => { nextHands[roster[i % roster.length].id].push(card); });

    publish({
      ...base,
      phase: 'memorize',
      hands: nextHands,
      round: base.round + 1,
      revealsThisRound: 0,
      activePlayerId: lastOwnerId,
      memorizeEndTimestamp: Date.now() + MEMORIZE_DURATION_MS,
    });
  }

  // ---- Host: validate an incoming tap, then resolve it ----
  function handleReveal(senderId: string | undefined, cardIndex: number, actedTurn: number) {
    if (phase !== 'table' || winner) return;
    if (actedTurn !== turn) return;                       // stale / duplicate / echoed tap
    if (!senderId || senderId === activePlayerId) return; // can't reveal your own phone's card
    if (!hands[senderId]) return;
    resolveReveal(senderId, cardIndex);
  }

  // ---- Host: deal a fresh game ----
  function dealGame(): GameState {
    const players = roster;
    const { explode, wire, blank } = deckCompositionFor(players.length);
    const deck: CardType[] = shuffle([
      ...Array<CardType>(explode).fill('explode'),
      ...Array<CardType>(wire).fill('wire'),
      ...Array<CardType>(blank).fill('blank'),
    ]);

    const nextHands: Record<string, Card[]> = {};
    players.forEach((p, i) => {
      nextHands[p.id] = deck
        .slice(i * CARDS_PER_PLAYER, i * CARDS_PER_PLAYER + CARDS_PER_PLAYER)
        .map((type) => ({ type, revealed: false }));
    });

    const rebelIds = new Set(shuffle([...players]).slice(0, rebelCountFor(players.length)).map((p) => p.id));
    const nextRoles: Record<string, Role> = {};
    players.forEach((p) => { nextRoles[p.id] = rebelIds.has(p.id) ? 'rebel' : 'peacekeeper'; });

    const revealEnd = Date.now() + ROLE_REVEAL_DURATION_MS;
    return {
      phase: 'role-reveal',
      roles: nextRoles,
      hands: nextHands,
      activePlayerId: '',
      wiresRevealed: 0,
      turn: 0,
      roleRevealEndTimestamp: revealEnd,
      memorizeEndTimestamp: null,
      winner: null,
      lastReveal: null,
      round: 1,
      revealsThisRound: 0,
      pendingWinner: null,
    };
  }

  function applyState(s: GameState) {
    setPhase(s.phase); setRoles(s.roles); setHands(s.hands); setActivePlayerId(s.activePlayerId);
    setWiresRevealed(s.wiresRevealed); setTurn(s.turn);
    setRoleRevealEndTimestamp(s.roleRevealEndTimestamp); setMemorizeEndTimestamp(s.memorizeEndTimestamp);
    setWinner(s.winner); setLastReveal(s.lastReveal);
    setRound(s.round); setRevealsThisRound(s.revealsThisRound); setPendingWinner(s.pendingWinner);
  }

  // ---- Host: initialize the game on a fresh start ----
  useEffect(() => {
    if (isHost && (phase === 'starting' || freshStart)) {
      if (roster.length === 0) return;
      const s = dealGame();
      applyState(s);
      sendMessage({ type: 'bomb-state-update', timestamp: Date.now(), payload: s });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, freshStart, roster.length]);

  // ---- Host transitions (called directly by both the timer effects and the
  // debug skips, so a skip never depends on a countdown re-firing) ----
  function goToMemorize() {
    const memoEnd = Date.now() + MEMORIZE_DURATION_MS;
    setPhase('memorize'); setRoleRevealEndTimestamp(null); setMemorizeEndTimestamp(memoEnd);
    broadcastState({ phase: 'memorize', roleRevealEndTimestamp: null, memorizeEndTimestamp: memoEnd });
  }

  function goToTable() {
    // Flip every hand face-down and shuffle its order so the 60s of study can't
    // be turned into "the bomb is the third card".
    const shuffledHands: Record<string, Card[]> = {};
    Object.entries(hands).forEach(([pid, hand]) => { shuffledHands[pid] = shuffle(hand); });
    // Rounds 2 and 3 open with whoever's card was flipped last; round 1 is random.
    const carried = roster.some((p) => p.id === activePlayerId) ? activePlayerId : '';
    const firstPicker = carried || roster[Math.floor(Math.random() * roster.length)]?.id || '';
    setPhase('table'); setHands(shuffledHands); setActivePlayerId(firstPicker); setMemorizeEndTimestamp(null);
    broadcastState({ phase: 'table', hands: shuffledHands, activePlayerId: firstPicker, memorizeEndTimestamp: null });
  }

  // ---- Host transition: Role Reveal -> Memorize ----
  useEffect(() => {
    if (isHost && phase === 'role-reveal' && roleRevealEndTimestamp && roleExpired) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      goToMemorize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, phase, roleRevealEndTimestamp, roleExpired]);

  // ---- Host transition: Memorize -> Table ----
  useEffect(() => {
    if (isHost && phase === 'memorize' && memorizeEndTimestamp && memoExpired) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      goToTable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, phase, memorizeEndTimestamp, memoExpired]);

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

  // ---- Client: tap a card on my own phone (someone reached over and tapped it) ----
  function tapCard(cardIndex: number) {
    if (phase !== 'table' || winner || pendingWinner || playerId === activePlayerId) return;
    if (hands[playerId]?.[cardIndex]?.revealed) return;
    if (isHost) {
      handleReveal(playerId, cardIndex, turn);
    } else {
      sendMessage({ type: 'reveal-card', playerId, timestamp: Date.now(), payload: { cardIndex, turn } });
    }
  }

  // ---- Host: play again -> back to lobby ----
  function playAgain() {
    sendMessage({ type: 'play-again', timestamp: Date.now(), payload: {} });
  }

  // ---- Debug (host authority) ----
  function handleDebugHostAction(action: string) {
    if (!isHost) return;
    if (action === 'skip-role' && phase === 'role-reveal') {
      goToMemorize();
    } else if (action === 'skip-memorize' && phase === 'memorize') {
      goToTable();
    } else if (action === 'reveal-wire' && phase === 'table' && !winner) {
      revealFirstOfType('wire');
    } else if (action === 'reveal-blank' && phase === 'table' && !winner) {
      revealFirstOfType('blank');
    } else if (action === 'reveal-bomb' && phase === 'table' && !winner) {
      revealFirstOfType('explode');
    }
  }

  // Debug shortcut: reveal the first unrevealed card of a type anywhere (unlike a
  // real tap, it doesn't skip the active phone — this is a test/host convenience).
  function revealFirstOfType(type: CardType) {
    for (const p of roster) {
      const hand = hands[p.id];
      const idx = hand?.findIndex((c) => c.type === type && !c.revealed) ?? -1;
      if (idx >= 0) { resolveReveal(p.id, idx); return; }
    }
  }

  function triggerAction(action: string) {
    if (isHost) handleDebugHostAction(action);
    else sendMessage({ type: 'debug-host-action', playerId, timestamp: Date.now(), payload: { action } });
  }

  function getDebugActions(): DebugAction[] {
    const list: DebugAction[] = [];
    if (phase === 'role-reveal') list.push({ label: '⏭️ Skip to Memorize', onClick: () => triggerAction('skip-role'), variant: 'warning' });
    if (phase === 'memorize') list.push({ label: '⏭️ Skip to Table', onClick: () => triggerAction('skip-memorize'), variant: 'warning' });
    if (phase === 'table' && !winner) {
      list.push({ label: '✂️ Reveal a Cut Wire', onClick: () => triggerAction('reveal-wire'), variant: 'primary' });
      list.push({ label: '▢ Reveal a Blank', onClick: () => triggerAction('reveal-blank'), variant: 'secondary' });
      list.push({ label: '💥 Reveal the Bomb', onClick: () => triggerAction('reveal-bomb'), variant: 'danger' });
    }
    return list;
  }

  // ---- Message handler ----
  useEffect(() => {
    onRegisterMessageHandler((envelope: Envelope) => {
      const { type, payload, playerId: senderId } = envelope;
      if (type === 'bomb-state-update') {
        if (!isHost) applyState(payload as GameState);
      } else if (type === 'debug-host-action') {
        if (isHost) handleDebugHostAction((payload as { action: string }).action);
      } else if (isHost) {
        if (type === 'reveal-card') {
          const p = payload as { cardIndex: number; turn: number };
          handleReveal(senderId, p.cardIndex, p.turn);
        } else if (type === 'bomb-request-state') {
          if (phase !== 'starting') broadcastState({});
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, roster, phase, roles, hands, activePlayerId, wiresRevealed, turn, winner, roleRevealEndTimestamp, memorizeEndTimestamp, lastReveal, round, revealsThisRound, pendingWinner]);

  // ---- Register debug actions ----
  useEffect(() => {
    if (DEBUG_MODE && onRegisterDebugActions) onRegisterDebugActions(getDebugActions(), phase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turn, winner, activePlayerId, wiresRevealed]);

  // ---- Confetti on a win ----
  useEffect(() => {
    if (phase === 'results') confetti({ particleCount: 150, spread: 80, origin: { y: 0.4 }, colors: CONFETTI_COLORS });
  }, [phase]);

  // ============================ RENDER ============================
  const myRole = roles[playerId];
  const myHand = hands[playerId] ?? [];
  const isMyTurn = phase === 'table' && activePlayerId === playerId;
  const activeName = roster.find((p) => p.id === activePlayerId)?.name ?? '';

  return (
    <div className="w-full flex-1 flex flex-col items-center">
      {phase === 'starting' && (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-brodin-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {phase === 'role-reveal' && (
        <RoleReveal role={myRole} isDisplay={isDisplay} seconds={roleSec} />
      )}

      {phase === 'memorize' && (
        <LandscapeStage>
          <MemorizeView
            role={myRole}
            hand={myHand}
            seconds={memoSec}
            isDisplay={isDisplay}
            isHost={isHost}
            round={round}
            wiresRevealed={wiresRevealed}
            onReady={goToTable}
            onQuit={onQuit}
          />
        </LandscapeStage>
      )}

      {phase === 'table' && (
        <LandscapeStage>
          <TableView
            hand={myHand}
            isMyTurn={isMyTurn}
            activeName={activeName}
            wiresRevealed={wiresRevealed}
            lastReveal={lastReveal}
            isDisplay={isDisplay}
            round={round}
            revealsThisRound={revealsThisRound}
            revealsPerRound={roster.length}
            pendingWinner={pendingWinner}
            onTap={tapCard}
            onQuit={onQuit}
          />
        </LandscapeStage>
      )}

      {phase === 'results' && (
        <ResultsView
          winner={winner}
          roles={roles}
          roster={roster}
          isHost={isHost}
          onPlayAgain={playAgain}
          onQuit={onQuit}
        />
      )}
    </div>
  );
}

