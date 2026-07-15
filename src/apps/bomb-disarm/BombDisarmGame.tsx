import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useCountdown } from '../../shared/hooks/useCountdown';
import { loadSnapshot, saveSnapshot, gameSnapshotKey } from '../../shared/utils/sessionSnapshot';
import type { Envelope } from '../../shared/types';
import type { GamePlayProps } from '../../shared/GameShell';
import { DEBUG_MODE } from '../../shared/constants';
import { type DebugAction } from '../../shared/components/DebugWidget';
import type {
  CardType, EffectChoice, EndReason, GameState, LastReveal, PendingEffect, Role, Winner,
} from './types';
import {
  MEMORIZE_DURATION_MS,
  ROLE_REVEAL_DURATION_MS,
  RESULT_REVEAL_DELAY_MS,
  PEEK_DURATION_MS,
  ROUNDS,
  WIRE_WIN_THRESHOLD,
  STATE_REQUEST_RETRY_INTERVAL_MS,
  STATE_REQUEST_MAX_ATTEMPTS,
} from './constants';
import { isSpecial } from './cards';
import { assignRoles, folkHeroId, isSidelined } from './roles';
import { buildDeck, dealHands, redeal, shuffle, swapCards } from './deck';
import { specialRolesForDeal, specialsForDeal } from './settings';
import LandscapeStage from './components/LandscapeStage';
import { RoleReveal, MemorizeView, TableView, ResultsView } from './components/BombViews';

interface BombSnapshot {
  bomb: GameState;
}

const CONFETTI_COLORS = ['#f9749f', '#03d1b9', '#facc15'];

const EMPTY: GameState = {
  phase: 'starting',
  round: 1,
  revealsThisRound: 0,
  pendingWinner: null,
  pendingEffect: null,
  peek: null,
  rogueAgentId: null,
  deckAdditions: [],
  effectNote: null,
  roles: {},
  specialRoles: {},
  revealedRoleIds: [],
  folkHeroSpent: false,
  opportunistTeam: null,
  pendingRescue: null,
  endReason: null,
  hands: {},
  activePlayerId: '',
  wiresRevealed: 0,
  turn: 0,
  roleRevealEndTimestamp: null,
  memorizeEndTimestamp: null,
  winner: null,
  lastReveal: null,
};

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
  onGameBgChange,
}: GamePlayProps) {
  const restored = freshStart ? null : loadSnapshot<BombSnapshot>(gameSnapshotKey(code))?.bomb ?? null;

  // One object rather than a field-per-useState: every host transition ships the
  // whole state anyway, and a missing field here is a desync on someone's phone.
  const [state, setState] = useState<GameState>({ ...EMPTY, ...restored });
  const {
    phase, roles, specialRoles, hands, activePlayerId, wiresRevealed, turn, round, revealsThisRound,
    roleRevealEndTimestamp, memorizeEndTimestamp, winner, lastReveal,
    pendingWinner, pendingEffect, peek, deckAdditions, pendingRescue, opportunistTeam,
  } = state;

  const nameOf = (id: string) => roster.find((p) => p.id === id)?.name ?? '?';

  // ---- Persist a snapshot for refresh-resume ----
  useEffect(() => {
    const current = loadSnapshot<Record<string, unknown>>(gameSnapshotKey(code)) ?? {};
    saveSnapshot(gameSnapshotKey(code), { ...current, bomb: state });
  }, [code, state]);

  // ---- Timers ----
  const { msRemaining: roleMs, expired: roleExpired } = useCountdown(roleRevealEndTimestamp);
  const { msRemaining: memoMs, expired: memoExpired } = useCountdown(memorizeEndTimestamp);
  const { expired: peekExpired } = useCountdown(peek?.endTimestamp ?? null);
  const memoSec = Math.ceil(memoMs / 1000);
  const roleSec = Math.ceil(roleMs / 1000);

  function publish(next: GameState) {
    setState(next);
    sendMessage({ type: 'bomb-state-update', timestamp: Date.now(), payload: next });
  }

  function patch(fields: Partial<GameState>) {
    publish({ ...state, ...fields });
  }

  // ---- Host: does anyone other than `pid` still have an unrevealed card? ----
  function hasValidTarget(pid: string, handsState: GameState['hands']): boolean {
    return roster.some((p) => p.id !== pid && (handsState[p.id]?.some((c) => !c.revealed) ?? false));
  }

  // The winning card sits face-up for a beat so the table can see what happened.
  function finishWith(base: GameState, won: Winner, reason: EndReason) {
    const held: GameState = { ...base, pendingWinner: won, endReason: reason, pendingRescue: null };
    publish(held);
    setTimeout(() => publish({ ...held, phase: 'results', winner: won }), RESULT_REVEAL_DELAY_MS);
  }

  // A Folk Hero who spent their save keeps their cards on the table but never
  // picks again.
  function canPick(pid: string, base: GameState): boolean {
    return !isSidelined(pid, base) && hasValidTarget(pid, base.hands);
  }

  // ---- Host: hand the pick to the next phone, or close out the round ----
  function advanceTurn(base: GameState, ownerId: string) {
    if (base.revealsThisRound >= roster.length) {
      if (base.round >= ROUNDS) return finishWith(base, 'rebels', 'timeout');
      return endRound(base, ownerId);
    }
    // Normally the pick passes to the phone that was just tapped — unless a Rogue
    // Agent has taken the round, in which case it keeps coming back to them.
    let nextActive = base.rogueAgentId ?? ownerId;
    if (!canPick(nextActive, base)) {
      const fallback = roster.find((p) => canPick(p.id, base));
      if (!fallback) return finishWith(base, 'rebels', 'timeout');
      nextActive = fallback.id;
    }
    publish({ ...base, activePlayerId: nextActive });
  }

  // ---- Host: drop the revealed cards, reshuffle the rest, redeal, re-memorize ----
  function endRound(base: GameState, lastOwnerId: string) {
    publish({
      ...base,
      phase: 'memorize',
      hands: redeal(roster.map((p) => p.id), base.hands, base.deckAdditions),
      round: base.round + 1,
      revealsThisRound: 0,
      activePlayerId: lastOwnerId,
      memorizeEndTimestamp: Date.now() + MEMORIZE_DURATION_MS,
      rogueAgentId: null,
      pendingEffect: null,
      peek: null,
      pendingRescue: null,
      deckAdditions: [],
      effectNote: null,
      lastReveal: null,
    });
  }

  // ---- Host: reveal a card and resolve the turn (shared by taps and debug) ----
  function resolveReveal(ownerId: string, cardIndex: number) {
    const hand = hands[ownerId];
    if (!hand || cardIndex < 0 || cardIndex >= hand.length || hand[cardIndex].revealed) return;
    if (pendingWinner || pendingEffect || peek || pendingRescue) return;

    const card = hand[cardIndex];
    const actorId = activePlayerId;
    const reveal: LastReveal = { targetId: ownerId, targetName: nameOf(ownerId), cardIndex, type: card.type };

    const base: GameState = {
      ...state,
      phase: 'table',
      hands: { ...hands, [ownerId]: hand.map((c, i) => (i === cardIndex ? { ...c, revealed: true } : c)) },
      wiresRevealed: wiresRevealed + (card.type === 'wire' ? 1 : 0),
      turn: turn + 1,
      revealsThisRound: revealsThisRound + 1,
      lastReveal: reveal,
      roleRevealEndTimestamp: null,
      memorizeEndTimestamp: null,
      winner: null,
      pendingWinner: null,
      pendingEffect: null,
      peek: null,
      pendingRescue: null,
      effectNote: null,
    };

    if (card.type === 'explode') {
      // A Folk Hero who hasn't spent themselves yet gets the chance to stop it.
      const hero = folkHeroId(base);
      if (hero && !base.folkHeroSpent) {
        return publish({ ...base, pendingRescue: { bombOwnerId: ownerId, heroId: hero } });
      }
      return finishWith(base, 'rebels', 'bomb');
    }
    if (base.wiresRevealed >= WIRE_WIN_THRESHOLD) return finishWith(base, 'peacekeepers', 'wires');

    if (card.type === 'rogue-agent') {
      return advanceTurn(
        { ...base, rogueAgentId: actorId, effectNote: `${nameOf(actorId)} went rogue — they pick every card for the rest of the round` },
        ownerId,
      );
    }

    // A Repair Kit in the final round has no next deal to salt, so it does nothing.
    const asksAQuestion =
      card.type === 'interrogate' ||
      card.type === 'user-manual' ||
      card.type === 'crossed-wires' ||
      (card.type === 'repair-kit' && base.round < ROUNDS);

    if (asksAQuestion) {
      const effect: PendingEffect = {
        type: card.type as PendingEffect['type'],
        actorId,
        firstPick: null,
        role: null,
        roleTargetName: null,
      };
      return publish({ ...base, pendingEffect: effect });
    }

    // Blanks, wires, Silence, and a spent Repair Kit all just pass the turn on.
    advanceTurn(base, ownerId);
  }

  // ---- Host: the actor answered their special card ----
  function handleEffectChoice(senderId: string | undefined, choice: EffectChoice) {
    const effect = pendingEffect;
    if (!effect || !senderId || senderId !== effect.actorId) return;
    // The card that started this is still the last thing revealed, and its owner
    // is who the turn passes to once the effect is done.
    const ownerId = lastReveal?.targetId ?? '';

    if (effect.type === 'interrogate') {
      if (choice.kind === 'player') {
        const role = roles[choice.playerId];
        if (!role || choice.playerId === effect.actorId) return;
        return patch({ pendingEffect: { ...effect, role, roleTargetName: nameOf(choice.playerId) } });
      }
      if (choice.kind === 'done' && effect.role) {
        return advanceTurn(
          { ...state, pendingEffect: null, effectNote: `${nameOf(effect.actorId)} interrogated ${effect.roleTargetName}` },
          ownerId,
        );
      }
      return;
    }

    if (effect.type === 'repair-kit' && choice.kind === 'repair') {
      return advanceTurn(
        {
          ...state,
          pendingEffect: null,
          deckAdditions: [...deckAdditions, choice.cardType],
          effectNote: `${nameOf(effect.actorId)} used the repair kit`,
        },
        ownerId,
      );
    }

    if (choice.kind !== 'card') return;
    const target = hands[choice.playerId]?.[choice.cardIndex];
    if (!target || target.revealed) return;

    if (effect.type === 'user-manual') {
      return patch({
        pendingEffect: null,
        peek: {
          card: { playerId: choice.playerId, cardIndex: choice.cardIndex },
          type: target.type,
          ownerName: nameOf(choice.playerId),
          endTimestamp: Date.now() + PEEK_DURATION_MS,
        },
        effectNote: `${nameOf(effect.actorId)} read the manual on one of ${nameOf(choice.playerId)}'s cards`,
      });
    }

    if (effect.type === 'crossed-wires') {
      if (!effect.firstPick) {
        return patch({
          pendingEffect: { ...effect, firstPick: { playerId: choice.playerId, cardIndex: choice.cardIndex } },
        });
      }
      // The two cards have to come from different players, or nothing moves.
      if (effect.firstPick.playerId === choice.playerId) return;
      const second = { playerId: choice.playerId, cardIndex: choice.cardIndex };
      return advanceTurn(
        {
          ...state,
          hands: swapCards(hands, effect.firstPick, second),
          pendingEffect: null,
          effectNote: `Cards were swapped between ${nameOf(effect.firstPick.playerId)} and ${nameOf(choice.playerId)}`,
        },
        ownerId,
      );
    }
  }

  // ---- Host: the Folk Hero answers the bomb ----
  function handleRescue(senderId: string | undefined, save: boolean) {
    const rescue = pendingRescue;
    if (!rescue || !senderId || senderId !== rescue.heroId) return;

    if (!save) return finishWith({ ...state, pendingRescue: null }, 'rebels', 'bomb');

    advanceTurn(
      {
        ...state,
        pendingRescue: null,
        folkHeroSpent: true,
        revealedRoleIds: [...state.revealedRoleIds, rescue.heroId],
        effectNote: `🦸 ${nameOf(rescue.heroId)} threw themselves on the bomb — the game goes on, but they're out of the picking`,
      },
      rescue.bombOwnerId,
    );
  }

  // ---- Host: the Opportunist flips their card and picks a side, in the open ----
  function handleDeclare(senderId: string | undefined, team: Role) {
    if (!senderId || specialRoles[senderId] !== 'opportunist') return;
    if (opportunistTeam || phase !== 'table' || winner || pendingWinner) return;
    if (senderId !== activePlayerId) return;

    patch({
      roles: { ...roles, [senderId]: team },
      opportunistTeam: team,
      revealedRoleIds: [...state.revealedRoleIds, senderId],
      effectNote: `🎭 ${nameOf(senderId)} flipped their card — they're a ${team === 'rebel' ? 'Rebel' : 'Peacekeeper'}`,
    });
  }

  // ---- Host: the peeked card turns back over and play resumes ----
  useEffect(() => {
    if (!isHost || !peek || !peekExpired) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    advanceTurn({ ...state, peek: null }, lastReveal?.targetId ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, peek, peekExpired]);

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
    const ids = roster.map((p) => p.id);
    const deck = buildDeck(roster.length, specialsForDeal(code, roster.length));
    const { roles: nextRoles, specialRoles: nextSpecialRoles } = assignRoles(
      ids,
      specialRolesForDeal(code, roster.length),
    );

    return {
      ...EMPTY,
      phase: 'role-reveal',
      roles: nextRoles,
      specialRoles: nextSpecialRoles,
      hands: dealHands(ids, deck),
      roleRevealEndTimestamp: Date.now() + ROLE_REVEAL_DURATION_MS,
    };
  }

  // ---- Host: initialize the game on a fresh start ----
  useEffect(() => {
    if (isHost && (phase === 'starting' || freshStart)) {
      if (roster.length === 0) return;
      const s = dealGame();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(s);
      sendMessage({ type: 'bomb-state-update', timestamp: Date.now(), payload: s });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, freshStart, roster.length]);

  // ---- Host transitions (called directly by both the timer effects and the
  // debug skips, so a skip never depends on a countdown re-firing) ----
  function goToMemorize() {
    patch({ phase: 'memorize', roleRevealEndTimestamp: null, memorizeEndTimestamp: Date.now() + MEMORIZE_DURATION_MS });
  }

  function goToTable() {
    // Flip every hand face-down and shuffle its order so the 60s of study can't
    // be turned into "the bomb is the third card".
    const shuffledHands: GameState['hands'] = {};
    Object.entries(hands).forEach(([pid, hand]) => { shuffledHands[pid] = shuffle(hand); });
    // Rounds 2 and 3 open with whoever's card was flipped last; round 1 is random.
    const carried = roster.some((p) => p.id === activePlayerId) ? activePlayerId : '';
    const firstPicker = carried || roster[Math.floor(Math.random() * roster.length)]?.id || '';
    patch({ phase: 'table', hands: shuffledHands, activePlayerId: firstPicker, memorizeEndTimestamp: null });
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
    if (phase !== 'table' || winner || pendingWinner || pendingEffect || peek || pendingRescue) return;
    if (playerId === activePlayerId) return;
    if (hands[playerId]?.[cardIndex]?.revealed) return;
    if (isHost) {
      handleReveal(playerId, cardIndex, turn);
    } else {
      sendMessage({ type: 'reveal-card', playerId, timestamp: Date.now(), payload: { cardIndex, turn } });
    }
  }

  // ---- Client: answer the special card I just flipped ----
  function chooseEffect(choice: EffectChoice) {
    if (pendingEffect?.actorId !== playerId) return;
    if (isHost) {
      handleEffectChoice(playerId, choice);
    } else {
      sendMessage({ type: 'bomb-effect-choice', playerId, timestamp: Date.now(), payload: choice });
    }
  }

  // ---- Client: I'm the Folk Hero and a bomb just turned up ----
  function chooseRescue(save: boolean) {
    if (pendingRescue?.heroId !== playerId) return;
    if (isHost) handleRescue(playerId, save);
    else sendMessage({ type: 'bomb-rescue', playerId, timestamp: Date.now(), payload: { save } });
  }

  // ---- Client: I'm the Opportunist and I'm picking a side ----
  function declareTeam(team: Role) {
    if (isHost) handleDeclare(playerId, team);
    else sendMessage({ type: 'bomb-declare', playerId, timestamp: Date.now(), payload: { team } });
  }

  // ---- Host: play again -> back to lobby ----
  function playAgain() {
    sendMessage({ type: 'play-again', timestamp: Date.now(), payload: {} });
  }

  // ---- Debug (host authority) ----
  function handleDebugHostAction(action: string) {
    if (!isHost) return;
    if (action === 'skip-role' && phase === 'role-reveal') return goToMemorize();
    if (action === 'skip-memorize' && phase === 'memorize') return goToTable();
    if (phase !== 'table' || winner) return;
    if (action === 'answer-effect') return autoAnswerEffect();
    if (action === 'rescue-save') return handleRescue(pendingRescue?.heroId, true);
    if (action === 'rescue-decline') return handleRescue(pendingRescue?.heroId, false);
    if (action === 'declare-rebel' || action === 'declare-peacekeeper') {
      const opportunist = Object.entries(specialRoles).find(([, r]) => r === 'opportunist')?.[0];
      return handleDeclare(opportunist, action === 'declare-rebel' ? 'rebel' : 'peacekeeper');
    }
    if (action === 'reveal-wire') revealFirstOfType((t) => t === 'wire');
    else if (action === 'reveal-blank') revealFirstOfType((t) => t === 'blank');
    else if (action === 'reveal-bomb') revealFirstOfType((t) => t === 'explode');
    else if (action === 'reveal-special') revealFirstOfType(isSpecial);
  }

  // A bot can't pick up its phone to answer a special, so a special flipped on a
  // bot's turn would sit forever. Answer for whoever the actor is.
  function autoAnswerEffect() {
    const effect = pendingEffect;
    if (!effect) return;
    const faceDown = (skip?: string) => {
      for (const p of roster) {
        if (p.id === skip) continue;
        const idx = hands[p.id]?.findIndex((c) => !c.revealed) ?? -1;
        if (idx >= 0) return { kind: 'card', playerId: p.id, cardIndex: idx } as const;
      }
      return null;
    };

    let choice: EffectChoice | null;
    if (effect.type === 'interrogate') {
      choice = effect.role
        ? { kind: 'done' }
        : { kind: 'player', playerId: roster.find((p) => p.id !== effect.actorId)?.id ?? '' };
    } else if (effect.type === 'repair-kit') {
      choice = { kind: 'repair', cardType: 'wire' };
    } else {
      choice = faceDown(effect.firstPick?.playerId);
    }
    if (choice) handleEffectChoice(effect.actorId, choice);
  }

  // Debug shortcut: reveal the first unrevealed card matching a predicate (unlike
  // a real tap, it doesn't skip the active phone — a test/host convenience).
  function revealFirstOfType(match: (type: CardType) => boolean) {
    for (const p of roster) {
      const idx = hands[p.id]?.findIndex((c) => match(c.type) && !c.revealed) ?? -1;
      if (idx >= 0) return resolveReveal(p.id, idx);
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
      const opportunist = Object.entries(specialRoles).find(([, r]) => r === 'opportunist')?.[0];
      if (pendingRescue) {
        list.push({ label: `🦸 Save (as ${nameOf(pendingRescue.heroId)})`, onClick: () => triggerAction('rescue-save'), variant: 'success' });
        list.push({ label: '💥 Let it blow', onClick: () => triggerAction('rescue-decline'), variant: 'danger' });
      } else if (pendingEffect) {
        list.push({ label: `🤖 Answer for ${nameOf(pendingEffect.actorId)}`, onClick: () => triggerAction('answer-effect'), variant: 'primary' });
      } else if (!peek) {
        if (opportunist && opportunist !== playerId && !opportunistTeam && opportunist === activePlayerId) {
          list.push({ label: `🎭 Flip ${nameOf(opportunist)} → Rebel`, onClick: () => triggerAction('declare-rebel'), variant: 'warning' });
        }
        list.push({ label: '✂️ Reveal a Cut Wire', onClick: () => triggerAction('reveal-wire'), variant: 'primary' });
        list.push({ label: '▢ Reveal a Blank', onClick: () => triggerAction('reveal-blank'), variant: 'secondary' });
        list.push({ label: '🎴 Reveal a Special', onClick: () => triggerAction('reveal-special'), variant: 'success' });
        list.push({ label: '💥 Reveal the Bomb', onClick: () => triggerAction('reveal-bomb'), variant: 'danger' });
      }
    }
    return list;
  }

  // ---- Message handler ----
  useEffect(() => {
    onRegisterMessageHandler((envelope: Envelope) => {
      const { type, payload, playerId: senderId } = envelope;
      if (type === 'bomb-state-update') {
        if (!isHost) setState({ ...EMPTY, ...(payload as GameState) });
      } else if (type === 'debug-host-action') {
        if (isHost) handleDebugHostAction((payload as { action: string }).action);
      } else if (isHost) {
        if (type === 'reveal-card') {
          const p = payload as { cardIndex: number; turn: number };
          handleReveal(senderId, p.cardIndex, p.turn);
        } else if (type === 'bomb-effect-choice') {
          handleEffectChoice(senderId, payload as EffectChoice);
        } else if (type === 'bomb-rescue') {
          handleRescue(senderId, (payload as { save: boolean }).save);
        } else if (type === 'bomb-declare') {
          handleDeclare(senderId, (payload as { team: Role }).team);
        } else if (type === 'bomb-request-state') {
          if (phase !== 'starting') patch({});
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, roster, state]);

  // ---- Register debug actions ----
  useEffect(() => {
    if (DEBUG_MODE && onRegisterDebugActions) onRegisterDebugActions(getDebugActions(), phase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turn, winner, activePlayerId, wiresRevealed, pendingEffect, peek, pendingRescue, opportunistTeam, specialRoles]);

  // ---- Confetti on a win ----
  useEffect(() => {
    if (phase === 'results') confetti({ particleCount: 150, spread: 80, origin: { y: 0.4 }, colors: CONFETTI_COLORS });
  }, [phase]);

  useEffect(() => {
    onGameBgChange?.('bg-bomb-bg');
    return () => onGameBgChange?.(null);
  }, [onGameBgChange]);

  // ============================ RENDER ============================
  const myHand = hands[playerId] ?? [];
  const isMyTurn = phase === 'table' && activePlayerId === playerId;
  const activeName = nameOf(activePlayerId);
  // An Opportunist who flipped to the rebels left a peacekeeper seat, in public.
  const extraRebels = opportunistTeam === 'rebel' ? 1 : 0;

  return (
    <div className="w-full flex-1 flex flex-col items-center">
      {phase === 'starting' && (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-brodin-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {phase === 'role-reveal' && (
        <RoleReveal role={roles[playerId]} special={specialRoles[playerId]} isDisplay={isDisplay} seconds={roleSec} />
      )}

      {phase === 'memorize' && (
        <LandscapeStage>
          <MemorizeView
            role={roles[playerId]}
            special={specialRoles[playerId]}
            hand={myHand}
            seconds={memoSec}
            isDisplay={isDisplay}
            isHost={isHost}
            round={round}
            wiresRevealed={wiresRevealed}
            playerCount={roster.length}
            extraRebels={extraRebels}
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
            playerCount={roster.length}
            extraRebels={extraRebels}
            state={state}
            playerId={playerId}
            roster={roster}
            onChooseEffect={chooseEffect}
            onChooseRescue={chooseRescue}
            onDeclare={declareTeam}
            onTap={tapCard}
            onQuit={onQuit}
          />
        </LandscapeStage>
      )}

      {phase === 'results' && (
        <ResultsView
          state={state}
          roster={roster}
          isHost={isHost}
          onPlayAgain={playAgain}
          onQuit={onQuit}
        />
      )}
    </div>
  );
}
