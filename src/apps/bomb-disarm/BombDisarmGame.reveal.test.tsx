import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import BombDisarmGame from './BombDisarmGame';
import type { Card, CardType, GameState } from './types';
import type { Envelope, PlayerInfo } from '../../shared/types';

const roster: PlayerInfo[] = [
  { id: 'h', name: 'Host' }, { id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' },
];

const card = (type: CardType, revealed = false): Card => ({ type, revealed });

// A table already dealt, everyone face-down, host to act first.
const TABLE_STATE: GameState = {
  phase: 'table', round: 1, revealsThisRound: 0, pendingWinner: null, pendingEffect: null,
  peek: null, rogueAgentId: null, deckAdditions: [], effectNote: null,
  roles: { h: 'peacekeeper', p1: 'peacekeeper', p2: 'rebel' },
  specialRoles: {}, revealedRoleIds: [], folkHeroSpent: false, opportunistTeam: null, leftoverRole: null,
  pendingRescue: null, endReason: null, smokeActive: false, roundSummary: null, discardRecap: null,
  hands: {
    h: [card('blank'), card('blank')],
    p1: [card('blank'), card('blank')],
    p2: [card('blank'), card('blank')],
  },
  activePlayerId: 'h', wiresRevealed: 0, turn: 0,
  roleRevealEndTimestamp: null, memorizeEndTimestamp: null, winner: null, lastReveal: null,
};

function renderHostAtTable() {
  const code = 'RVL1';
  sessionStorage.setItem(`brodin-game-${code}`, JSON.stringify({ bomb: TABLE_STATE }));
  let handler: ((e: Envelope) => void) | null = null;
  const sent: Envelope[] = [];
  render(
    <BombDisarmGame
      code={code} playerId="h" name="Host" isHost roster={roster} isConnected
      sendMessage={(p) => { sent.push(p as Envelope); return Promise.resolve(); }}
      isDisplay={false} freshStart={false}
      onRegisterMessageHandler={(h) => { handler = h; }}
      onQuit={() => {}} onRegisterDebugActions={() => {}} onGameBgChange={() => {}}
    />
  );
  const lastState = (): GameState => {
    const updates = sent.filter((e) => e.type === 'bomb-state-update');
    return (updates.length ? updates[updates.length - 1].payload : TABLE_STATE) as GameState;
  };
  // The handler re-registers every render, so read it fresh each time.
  const reveal = (owner: string, cardIndex: number, turn: number) =>
    act(() => { handler!({ type: 'reveal-card', playerId: owner, timestamp: 0, payload: { cardIndex, turn } } as Envelope); });
  return { reveal, lastState };
}

describe('BombDisarmGame reveals', () => {
  it('a flipped card stays flipped when another card is flipped', () => {
    const { reveal, lastState } = renderHostAtTable();

    // Alice's first card is flipped and set as flipped.
    reveal('p1', 0, 0);
    expect(lastState().hands.p1[0].revealed).toBe(true);

    // Another card is flipped (Bob's). The turn advanced to Alice after the
    // first reveal, so this pick is at turn 1.
    reveal('p2', 0, 1);

    // The original card STAYS flipped.
    const s = lastState();
    expect(s.hands.p2[0].revealed).toBe(true);
    expect(s.hands.p1[0].revealed).toBe(true);
  });
});

describe('BombDisarmGame interrogate', () => {
  it("saves the target player's special role in pendingEffect when interrogated", () => {
    const INTERROGATE_STATE: GameState = {
      ...TABLE_STATE,
      specialRoles: { p1: 'folk-hero' },
      pendingEffect: {
        type: 'interrogate',
        actorId: 'h',
        firstPick: null,
        role: null,
        roleTargetName: null,
      },
      lastReveal: {
        targetId: 'p2',
        targetName: 'Bob',
        cardIndex: 0,
        type: 'interrogate',
      },
    };

    const code = 'INT1';
    sessionStorage.setItem(`brodin-game-${code}`, JSON.stringify({ bomb: INTERROGATE_STATE }));
    let handler: ((e: Envelope) => void) | null = null;
    const sent: Envelope[] = [];

    render(
      <BombDisarmGame
        code={code} playerId="h" name="Host" isHost roster={roster} isConnected
        sendMessage={(p) => { sent.push(p as Envelope); return Promise.resolve(); }}
        isDisplay={false} freshStart={false}
        onRegisterMessageHandler={(h) => { handler = h; }}
        onQuit={() => {}} onRegisterDebugActions={() => {}} onGameBgChange={() => {}}
      />
    );

    act(() => {
      handler!({
        type: 'bomb-effect-choice',
        playerId: 'h',
        timestamp: 0,
        payload: { kind: 'player', playerId: 'p1' },
      } as Envelope);
    });

    const lastUpdate = sent.filter((e) => e.type === 'bomb-state-update').pop();
    expect(lastUpdate).toBeDefined();
    const payload = lastUpdate!.payload as GameState;
    expect(payload.pendingEffect).toBeDefined();
    expect(payload.pendingEffect!.role).toBe('peacekeeper');
    expect(payload.pendingEffect!.specialRole).toBe('folk-hero');
    expect(payload.pendingEffect!.roleTargetName).toBe('Alice');
  });
});
