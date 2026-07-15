import type { DebugAction } from '../../shared/components/DebugWidget';
import type { PlayerInfo } from '../../shared/types';
import { isSpecial } from './cards';
import type {
  BombPhase, Card, CardType, EffectChoice, GameState, PendingEffect, Role, SpecialRole, Winner,
} from './types';

interface DebugActionsDeps {
  isHost: boolean;
  playerId: string;
  roster: PlayerInfo[];
  nameOf: (id: string) => string;
  sendMessage: (payload: unknown) => Promise<void>;
  // Read-only slices of GameState needed to decide which debug buttons apply.
  phase: BombPhase;
  winner: Winner | null;
  hands: Record<string, Card[]>;
  activePlayerId: string;
  pendingRescue: GameState['pendingRescue'];
  pendingEffect: PendingEffect | null;
  peek: GameState['peek'];
  specialRoles: Record<string, SpecialRole>;
  opportunistTeam: Role | null;
  // Host actions this hook drives — all defined in the main component, since
  // they're the same code path a real tap or client message would take.
  resolveReveal: (ownerId: string, cardIndex: number) => void;
  handleEffectChoice: (senderId: string | undefined, choice: EffectChoice) => void;
  handleRescue: (senderId: string | undefined, save: boolean) => void;
  handleDeclare: (senderId: string | undefined, team: Role) => void;
  goToMemorize: () => void;
  goToTable: () => void;
}

// Everything the host-only debug widget needs: bots can't pick up a phone to
// answer a special or reveal a card, so these give a host full control over an
// otherwise-stuck game (and a fast path for manual testing).
export function useDebugActions(deps: DebugActionsDeps) {
  const {
    isHost, playerId, roster, nameOf, sendMessage,
    phase, winner, hands, activePlayerId, pendingRescue, pendingEffect, peek, specialRoles, opportunistTeam,
    resolveReveal, handleEffectChoice, handleRescue, handleDeclare, goToMemorize, goToTable,
  } = deps;

  // Debug shortcut: reveal the first unrevealed card matching a predicate (unlike
  // a real tap, it doesn't skip the active phone — a test/host convenience).
  function revealFirstOfType(match: (type: CardType) => boolean) {
    for (const p of roster) {
      const idx = hands[p.id]?.findIndex((c) => match(c.type) && !c.revealed) ?? -1;
      if (idx >= 0) return resolveReveal(p.id, idx);
    }
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
    } else if (effect.type === 'double-agent') {
      choice = { kind: 'swap', swap: false };
    } else {
      choice = faceDown(effect.firstPick?.playerId);
    }
    if (choice) handleEffectChoice(effect.actorId, choice);
  }

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

  return { handleDebugHostAction, getDebugActions };
}
