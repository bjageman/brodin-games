import { useEffect, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useCountdown } from '../../shared/hooks/useCountdown';
import { loadSnapshot, saveSnapshot, gameSnapshotKey } from '../../shared/utils/sessionSnapshot';
import type { Envelope } from '../../shared/types';
import type { GamePlayProps } from '../../shared/GameShell';
import { DEBUG_MODE } from '../../shared/constants';
import type {
  EffectChoice, EndReason, GameState, LastReveal, PendingEffect, Role, Winner,
} from './types';
import {
  MEMORIZE_DURATION_MS,
  RESULT_REVEAL_DELAY_MS,
  PEEK_DURATION_MS,
  ROUND_SUMMARY_DELAY_MS,
  ROUNDS,
  WIRE_WIN_THRESHOLD,
} from './constants';
import { folkHeroId, isSidelined } from './roles';
import { redeal, swapCards } from './deck';
import { useDebugActions } from './useDebugActions';
import { usePhaseTransitions } from './usePhaseTransitions';
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
  leftoverRole: null,
  pendingRescue: null,
  endReason: null,
  smokeActive: false,
  roundSummary: null,
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
    pendingWinner, pendingEffect, peek, deckAdditions, pendingRescue, opportunistTeam, leftoverRole,
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

  const publish = useCallback((next: GameState) => {
    setState(next);
    sendMessage({ type: 'bomb-state-update', timestamp: Date.now(), payload: next });
  }, [sendMessage]);

  const patch = useCallback((fields: Partial<GameState>) => {
    publish({ ...state, ...fields });
  }, [publish, state]);

  // ---- Host: does anyone other than `pid` still have an unrevealed card? ----
  const hasValidTarget = useCallback((pid: string, handsState: GameState['hands']): boolean => {
    return roster.some((p) => p.id !== pid && (handsState[p.id]?.some((c) => !c.revealed) ?? false));
  }, [roster]);

  // The winning card sits face-up for a beat so the table can see what happened.
  const finishWith = useCallback((base: GameState, won: Winner, reason: EndReason) => {
    const held: GameState = { ...base, pendingWinner: won, endReason: reason, pendingRescue: null };
    publish(held);
    setTimeout(() => publish({ ...held, phase: 'results', winner: won }), RESULT_REVEAL_DELAY_MS);
  }, [publish]);

  // A Folk Hero who spent their save keeps their cards on the table but never
  // picks again.
  const canPick = useCallback((pid: string, base: GameState): boolean => {
    return !isSidelined(pid, base) && hasValidTarget(pid, base.hands);
  }, [hasValidTarget]);

  // ---- Host: drop the revealed cards, reshuffle the rest, redeal, re-memorize ----
  const endRound = useCallback((base: GameState, lastOwnerId: string) => {
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
      smokeActive: false,
      roundSummary: null,
    });
  }, [roster, publish]);

  // ---- Host: a Smoke Bomb round ends with an anonymous tally instead of the
  // ordinary per-turn status, then rolls into the next round as usual ----
  const showRoundSummary = useCallback((base: GameState, lastOwnerId: string) => {
    const revealedThisRound = Object.values(base.hands).flat().filter((c) => c.revealed);
    const summary = {
      blanks: revealedThisRound.filter((c) => c.type === 'blank').length,
      wires: revealedThisRound.filter((c) => c.type === 'wire').length,
    };
    const withSummary = { ...base, roundSummary: summary };
    publish(withSummary);
    setTimeout(() => endRound({ ...withSummary, roundSummary: null }, lastOwnerId), ROUND_SUMMARY_DELAY_MS);
  }, [publish, endRound]);

  // ---- Host: hand the pick to the next phone, or close out the round ----
  const advanceTurn = useCallback((base: GameState, ownerId: string) => {
    if (base.revealsThisRound >= roster.length) {
      if (base.round >= ROUNDS) return finishWith(base, 'rebels', 'timeout');
      if (base.smokeActive) return showRoundSummary(base, ownerId);
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
  }, [roster, finishWith, showRoundSummary, endRound, canPick, publish]);

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

    if (card.type === 'smoke-bomb') {
      return advanceTurn(
        { ...base, smokeActive: true, effectNote: `${nameOf(actorId)} set off a smoke bomb — cut wires and blanks stay anonymous for the rest of the round` },
        ownerId,
      );
    }

    // A Repair Kit in the final round has no next deal to salt, so it does nothing.
    // Double Agent needs a hidden rebel count to swap into, which only exists at
    // 8+ players (see buildDeck) — it always has an effect once it's in the deck.
    const asksAQuestion =
      card.type === 'interrogate' ||
      card.type === 'user-manual' ||
      card.type === 'crossed-wires' ||
      card.type === 'double-agent' ||
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

    if (effect.type === 'double-agent' && choice.kind === 'swap') {
      // The old role becomes the new leftover — nobody ever needs to look at it
      // again unless another Double Agent turns up.
      const nextRoles = choice.swap && leftoverRole ? { ...roles, [effect.actorId]: leftoverRole } : roles;
      const nextLeftover = choice.swap && leftoverRole ? roles[effect.actorId] : leftoverRole;
      return advanceTurn(
        {
          ...state,
          roles: nextRoles,
          leftoverRole: nextLeftover,
          pendingEffect: null,
          effectNote: `${nameOf(effect.actorId)} used the Double Agent card`,
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
    const timer = setTimeout(() => {
      advanceTurn({ ...state, peek: null }, lastReveal?.targetId ?? '');
    }, 0);
    return () => clearTimeout(timer);
  }, [isHost, peek, peekExpired, advanceTurn, state, lastReveal]);

  // ---- Host: recover from a refresh during the winner reveal delay ----
  useEffect(() => {
    if (isHost && phase === 'table' && pendingWinner && !winner) {
      const timer = setTimeout(() => {
        publish({ ...state, phase: 'results', winner: pendingWinner });
      }, RESULT_REVEAL_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [isHost, phase, pendingWinner, winner, publish, state]);

  // ---- Host: recover from a refresh during the round summary delay ----
  useEffect(() => {
    if (isHost && phase === 'table' && state.roundSummary) {
      const timer = setTimeout(() => {
        const lastOwnerId = state.lastReveal?.targetId ?? '';
        endRound({ ...state, roundSummary: null }, lastOwnerId);
      }, ROUND_SUMMARY_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [isHost, phase, state.roundSummary, state.lastReveal, endRound, state]);

  // ---- Host: validate an incoming tap, then resolve it ----
  function handleReveal(senderId: string | undefined, cardIndex: number, actedTurn: number) {
    if (phase !== 'table' || winner) return;
    if (actedTurn !== turn) return;                       // stale / duplicate / echoed tap
    if (!senderId || senderId === activePlayerId) return; // can't reveal your own phone's card
    if (!hands[senderId]) return;
    resolveReveal(senderId, cardIndex);
  }

  // ---- Host: clock-driven phase changes (deal, role reveal, memorize, table) ----
  const { goToMemorize, goToTable } = usePhaseTransitions({
    code, playerId, roster, isHost, freshStart, phase, hands, activePlayerId,
    roleRevealEndTimestamp, roleExpired, memorizeEndTimestamp, memoExpired,
    emptyState: EMPTY, sendMessage, setState, patch,
  });

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
  const { handleDebugHostAction, getDebugActions } = useDebugActions({
    isHost, playerId, roster, nameOf, sendMessage,
    phase, winner, hands, activePlayerId, pendingRescue, pendingEffect, peek, specialRoles, opportunistTeam,
    resolveReveal, handleEffectChoice, handleRescue, handleDeclare, goToMemorize, goToTable,
  });

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
  });

  // ---- Register debug actions ----
  useEffect(() => {
    if (DEBUG_MODE && onRegisterDebugActions) onRegisterDebugActions(getDebugActions(), phase);
  }, [phase, turn, winner, activePlayerId, wiresRevealed, pendingEffect, peek, pendingRescue, opportunistTeam, specialRoles, getDebugActions, onRegisterDebugActions]);

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
