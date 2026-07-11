import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useCountdown } from '../../shared/hooks/useCountdown';
import { cn } from '../../shared/utils/cn';
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
  WIRE_WIN_THRESHOLD,
  STATE_REQUEST_RETRY_INTERVAL_MS,
  STATE_REQUEST_MAX_ATTEMPTS,
  deckCompositionFor,
  rebelCountFor,
} from './constants';
import LandscapeStage from './components/LandscapeStage';

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

  // ---- Persist a snapshot for refresh-resume ----
  useEffect(() => {
    const bomb: GameState = {
      phase, roles, hands, activePlayerId, wiresRevealed, turn,
      roleRevealEndTimestamp, memorizeEndTimestamp, winner, lastReveal,
    };
    const current = loadSnapshot<Record<string, unknown>>(gameSnapshotKey(code)) ?? {};
    saveSnapshot(gameSnapshotKey(code), { ...current, bomb });
  }, [code, phase, roles, hands, activePlayerId, wiresRevealed, turn, roleRevealEndTimestamp, memorizeEndTimestamp, winner, lastReveal]);

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
      ...fields,
    };
    sendMessage({ type: 'bomb-state-update', timestamp: Date.now(), payload: fullState });
  }

  // ---- Host: does anyone other than `pid` still have an unrevealed card? ----
  function hasValidTarget(pid: string, handsState: Record<string, Card[]>): boolean {
    return roster.some((p) => p.id !== pid && (handsState[p.id]?.some((c) => !c.revealed) ?? false));
  }

  // ---- Host: reveal a specific card and resolve the turn (shared by taps and debug) ----
  function resolveReveal(ownerId: string, cardIndex: number) {
    const hand = hands[ownerId];
    if (!hand || cardIndex < 0 || cardIndex >= hand.length || hand[cardIndex].revealed) return;

    const card = hand[cardIndex];
    const nextHands = {
      ...hands,
      [ownerId]: hand.map((c, i) => (i === cardIndex ? { ...c, revealed: true } : c)),
    };
    const ownerName = roster.find((p) => p.id === ownerId)?.name ?? '?';
    const reveal: LastReveal = { targetId: ownerId, targetName: ownerName, cardIndex, type: card.type };
    const nextTurn = turn + 1;
    const nextWires = wiresRevealed + (card.type === 'wire' ? 1 : 0);

    const finish = (won: Winner) => {
      setHands(nextHands); setLastReveal(reveal); setTurn(nextTurn); setWiresRevealed(nextWires);
      setWinner(won); setPhase('results');
      broadcastState({ hands: nextHands, lastReveal: reveal, turn: nextTurn, wiresRevealed: nextWires, winner: won, phase: 'results' });
    };

    if (card.type === 'explode') return finish('rebels');
    if (nextWires >= WIRE_WIN_THRESHOLD) return finish('peacekeepers');

    // Turn passes to the owner of the tapped phone. If they have no one left to
    // tap, hand off to anyone who does; if the whole table is stuck, the bomb
    // was never disarmed, so the rebels take it.
    let nextActive = ownerId;
    if (!hasValidTarget(nextActive, nextHands)) {
      const fallback = roster.find((p) => hasValidTarget(p.id, nextHands));
      if (!fallback) return finish('rebels');
      nextActive = fallback.id;
    }

    setHands(nextHands); setLastReveal(reveal); setTurn(nextTurn); setWiresRevealed(nextWires); setActivePlayerId(nextActive);
    broadcastState({ hands: nextHands, lastReveal: reveal, turn: nextTurn, wiresRevealed: nextWires, activePlayerId: nextActive });
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
    };
  }

  function applyState(s: GameState) {
    setPhase(s.phase); setRoles(s.roles); setHands(s.hands); setActivePlayerId(s.activePlayerId);
    setWiresRevealed(s.wiresRevealed); setTurn(s.turn);
    setRoleRevealEndTimestamp(s.roleRevealEndTimestamp); setMemorizeEndTimestamp(s.memorizeEndTimestamp);
    setWinner(s.winner); setLastReveal(s.lastReveal);
  }

  // ---- Host: initialize the game on a fresh start ----
  useEffect(() => {
    if (isHost && (phase === 'starting' || freshStart)) {
      if (roster.length === 0) return;
      const s = dealGame();
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const firstPicker = roster[Math.floor(Math.random() * roster.length)]?.id ?? '';
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
    if (phase !== 'table' || winner || playerId === activePlayerId) return;
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
  }, [isHost, roster, phase, roles, hands, activePlayerId, wiresRevealed, turn, winner, roleRevealEndTimestamp, memorizeEndTimestamp, lastReveal]);

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
          <MemorizeView role={myRole} hand={myHand} seconds={memoSec} isDisplay={isDisplay} onQuit={onQuit} />
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

// ============================ SUBVIEWS ============================

function CardFace({ card, faceUp, onTap, tappable }: { card: Card; faceUp: boolean; onTap?: () => void; tappable?: boolean }) {
  const shown = faceUp || card.revealed;
  const meta: Record<CardType, { icon: string; label: string; cls: string }> = {
    explode: { icon: '💥', label: 'BOMB', cls: 'from-red-500/30 to-brodin-panel border-red-500 text-red-300' },
    wire: { icon: '✂️', label: 'Cut Wire', cls: 'from-emerald-500/25 to-brodin-panel border-emerald-500 text-emerald-300' },
    blank: { icon: '▢', label: 'Blank', cls: 'from-white/5 to-brodin-panel border-white/10 text-gray-400' },
  };
  const m = meta[card.type];
  return (
    <button
      type="button"
      disabled={!tappable}
      onClick={onTap}
      className={cn(
        'aspect-[3/4] w-full rounded-2xl border-2 flex flex-col items-center justify-center gap-1 font-black transition-all select-none',
        shown
          ? cn('bg-gradient-to-br', m.cls)
          : 'bg-gradient-to-br from-brodin-panel to-brodin-field border-white/10 text-white/70',
        tappable && 'hover:scale-[1.03] active:scale-95 cursor-pointer shadow-lg shadow-black/30 ring-2 ring-brodin-accent/40',
        !tappable && !shown && 'opacity-90'
      )}
    >
      {shown ? (
        <>
          <span className="text-3xl sm:text-4xl">{m.icon}</span>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest">{m.label}</span>
        </>
      ) : (
        <span className="text-3xl sm:text-4xl opacity-40">?</span>
      )}
    </button>
  );
}

function HandGrid({ hand, faceUp, tappable, onTap }: { hand: Card[]; faceUp: boolean; tappable: boolean; onTap?: (i: number) => void }) {
  return (
    <div className="grid grid-cols-6 grid-rows-1 gap-2 sm:gap-3 w-full max-w-5xl mx-auto">
      {hand.map((card, i) => (
        <CardFace
          key={i}
          card={card}
          faceUp={faceUp}
          tappable={tappable && !card.revealed}
          onTap={onTap ? () => onTap(i) : undefined}
        />
      ))}
    </div>
  );
}

function RoleBadge({ role }: { role: Role | undefined }) {
  if (!role) return null;
  const rebel = role === 'rebel';
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-4 py-1.5 rounded-full border font-black uppercase tracking-widest text-xs',
        rebel ? 'bg-bento-pink/15 border-bento-pink text-bento-pink' : 'bg-brodin-accent/15 border-brodin-accent text-brodin-accent'
      )}
    >
      <span>{rebel ? '🧨' : '🛡️'}</span>
      {rebel ? 'Rebel' : 'Peacekeeper'}
    </div>
  );
}

function RoleReveal({ role, isDisplay, seconds }: { role: Role | undefined; isDisplay: boolean; seconds: number }) {
  if (isDisplay) {
    return (
      <div className="w-full max-w-md mx-auto py-10 px-4 text-center space-y-4 animate-fadeIn">
        <h2 className="font-display text-2xl font-extrabold text-white uppercase tracking-wider">Dealing roles…</h2>
        <p className="text-sm text-gray-400">Players are learning their team. Cards deal in {seconds}s.</p>
      </div>
    );
  }
  const rebel = role === 'rebel';
  return (
    <div className="w-full max-w-md mx-auto py-8 px-4 text-center space-y-8 animate-fadeIn">
      <h2 className="font-display text-2xl font-extrabold text-white tracking-wider uppercase">Your Team</h2>
      <div
        className={cn(
          'p-8 rounded-3xl border shadow-2xl space-y-5',
          rebel ? 'bg-gradient-to-br from-bento-pink/20 to-brodin-panel border-bento-pink'
                : 'bg-gradient-to-br from-brodin-accent/20 to-brodin-panel border-brodin-accent'
        )}
      >
        <span className="text-5xl">{rebel ? '🧨' : '🛡️'}</span>
        <h3 className={cn('font-display text-3xl font-black uppercase tracking-widest', rebel ? 'text-bento-pink' : 'text-brodin-accent')}>
          {rebel ? 'Rebel' : 'Peacekeeper'}
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed">
          {rebel
            ? 'Sabotage the disarm. You win the moment a bomb is revealed — steer the table toward it.'
            : 'Disarm the bomb. Reveal 6 cut wires before any bomb turns up, and avoid the explode cards.'}
        </p>
      </div>
      <div className="space-y-2">
        <div className="text-4xl font-black text-brodin-gold animate-bounce">{seconds}</div>
        <p className="text-xs uppercase tracking-widest text-gray-400">Dealing cards…</p>
      </div>
    </div>
  );
}

function StatusBar({ wiresRevealed, lastReveal, subtitle }: { wiresRevealed: number; lastReveal: LastReveal | null; subtitle: string }) {
  return (
    <div className="w-full flex items-center justify-between gap-3 px-4 py-2 bg-brodin-panel/70 backdrop-blur rounded-2xl border border-white/5">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: WIRE_WIN_THRESHOLD }).map((_, i) => (
          <span key={i} className={cn('w-3 h-3 rounded-full border', i < wiresRevealed ? 'bg-emerald-400 border-emerald-300' : 'bg-transparent border-white/25')} />
        ))}
        <span className="ml-2 text-xs font-bold text-emerald-300">{wiresRevealed}/{WIRE_WIN_THRESHOLD} wires</span>
      </div>
      <p className="text-xs font-semibold text-gray-300 truncate">
        {lastReveal
          ? lastReveal.type === 'explode'
            ? '💥 Bomb revealed!'
            : `${lastReveal.type === 'wire' ? '✂️ Cut wire' : '▢ Blank'} on ${lastReveal.targetName}`
          : subtitle}
      </p>
    </div>
  );
}

function MemorizeView({ role, hand, seconds, isDisplay, onQuit }: { role: Role | undefined; hand: Card[]; seconds: number; isDisplay: boolean; onQuit: () => void }) {
  return (
    <div className="flex flex-col h-full w-full p-3 sm:p-5 gap-3">
      <div className="flex items-center justify-between gap-3">
        <RoleBadge role={role} />
        <div className={cn('font-mono font-black text-lg', seconds <= 10 ? 'text-bento-pink animate-pulse' : 'text-brodin-gold')}>{seconds}s</div>
        <button onClick={onQuit} className="text-[11px] text-gray-400 underline">Quit</button>
      </div>
      <p className="text-center text-xs uppercase tracking-widest text-gray-400 font-bold">
        Memorize your hand — it flips face-down and shuffles when the timer ends
      </p>
      <div className="flex-1 flex items-center justify-center">
        {isDisplay
          ? <p className="text-sm text-gray-400">Players are memorizing their hands…</p>
          : <HandGrid hand={hand} faceUp tappable={false} />}
      </div>
    </div>
  );
}

function TableView({
  hand, isMyTurn, activeName, wiresRevealed, lastReveal, isDisplay, onTap, onQuit,
}: {
  hand: Card[]; isMyTurn: boolean; activeName: string; wiresRevealed: number; lastReveal: LastReveal | null;
  isDisplay: boolean; onTap: (i: number) => void; onQuit: () => void;
}) {
  return (
    <div className="flex flex-col h-full w-full p-3 sm:p-5 gap-3">
      <div className="flex items-center gap-3">
        <div className="flex-1"><StatusBar wiresRevealed={wiresRevealed} lastReveal={lastReveal} subtitle="Cards are face-down on the table" /></div>
        <button onClick={onQuit} className="text-[11px] text-gray-400 underline shrink-0">Quit</button>
      </div>

      <div className="text-center">
        {isDisplay ? (
          <p className="text-sm font-bold text-white"><span className="text-brodin-accent">{activeName || '…'}</span> is choosing a card to reveal</p>
        ) : isMyTurn ? (
          <p className="text-sm font-black text-brodin-accent animate-pulse uppercase tracking-wider">Your turn — reach over and tap a card on someone else's phone</p>
        ) : (
          <p className="text-sm font-bold text-white"><span className="text-brodin-accent">{activeName || '…'}</span> is choosing — your cards are tappable</p>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center">
        {isDisplay ? (
          <p className="text-sm text-gray-400">Watching the table…</p>
        ) : (
          <div className="relative w-full">
            <HandGrid hand={hand} faceUp={false} tappable={!isMyTurn} onTap={onTap} />
            {isMyTurn && (
              <div className="absolute inset-0 rounded-2xl bg-gray-950/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                <span className="bg-brodin-panel/90 px-4 py-2 rounded-xl border border-white/10 text-xs text-gray-200 font-bold">🔒 Your own cards are locked</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultsView({
  winner, roles, roster, isHost, onPlayAgain, onQuit,
}: {
  winner: Winner | null; roles: Record<string, Role>; roster: GamePlayProps['roster'];
  isHost: boolean; onPlayAgain: () => void; onQuit: () => void;
}) {
  const rebelsWon = winner === 'rebels';
  return (
    <div className="w-full max-w-xl mx-auto px-4 flex flex-col items-center space-y-6 animate-fadeIn py-6">
      <div
        className={cn(
          'w-full rounded-3xl p-6 text-center space-y-3 border shadow-xl',
          rebelsWon ? 'bg-gradient-to-br from-bento-pink/20 to-brodin-panel border-bento-pink'
                    : 'bg-gradient-to-br from-brodin-accent/20 to-brodin-panel border-brodin-accent'
        )}
      >
        <span className="text-5xl">{rebelsWon ? '💥' : '🛡️'}</span>
        <h2 className={cn('font-display text-3xl font-black uppercase tracking-widest', rebelsWon ? 'text-bento-pink' : 'text-brodin-accent')}>
          {rebelsWon ? 'Rebels Win' : 'Peacekeepers Win'}
        </h2>
        <p className="text-sm text-gray-300">
          {rebelsWon ? 'A bomb was revealed — the disarm failed.' : `${WIRE_WIN_THRESHOLD} cut wires revealed — the bomb is disarmed!`}
        </p>
      </div>

      <div className="w-full bg-brodin-panel p-5 rounded-2xl border border-white/5 space-y-2 shadow-lg">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-white/5 pb-2">Roles Revealed</h4>
        {roster.map((p) => {
          const rebel = roles[p.id] === 'rebel';
          return (
            <div key={p.id} className="flex justify-between items-center text-sm">
              <span className="font-bold text-white">{p.name}</span>
              <span className={cn('text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded', rebel ? 'bg-bento-pink/15 text-bento-pink' : 'bg-brodin-accent/15 text-brodin-accent')}>
                {rebel ? '🧨 Rebel' : '🛡️ Peacekeeper'}
              </span>
            </div>
          );
        })}
      </div>

      {isHost ? (
        <div className="w-full space-y-2">
          <button onClick={onPlayAgain} className="w-full bg-brodin-primary hover:bg-brodin-primaryDark text-white rounded-lg py-3 font-bold transition-colors uppercase tracking-wider text-sm shadow-lg shadow-brodin-primary/20">
            Play Again
          </button>
          <button onClick={onQuit} className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-3 font-semibold transition-colors uppercase tracking-wider text-sm">
            Quit Game
          </button>
        </div>
      ) : (
        <div className="w-full space-y-4 text-center">
          <p className="text-xs text-gray-400 animate-pulse">Waiting for the host to restart…</p>
          <button onClick={onQuit} className="text-xs text-gray-400 underline">Disconnect</button>
        </div>
      )}
    </div>
  );
}
