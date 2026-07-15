import type { PlayerInfo } from '../../shared/types';
import {
  ANSWER_DURATION_MS, BOSS_ANSWER_DURATION_MS, BOSS_CORRECT_ANSWER_SCORE, CORRECT_ANSWER_DAMAGE,
  MAX_ITEMS, REVEAL_DURATION_MS, REVIVE_HP, STARTING_HP, WRONG_ANSWER_DAMAGE,
} from './constants';
import { buildRoom, DUNGEON_LENGTH, pickQuestion } from './dungeon';
import type { ActiveRoom, GameState, PlayerCombat } from './types';

interface DungeonDeps {
  roster: PlayerInfo[];
  state: GameState;
  publish: (next: GameState) => void;
}

function reviveGhosts(players: Record<string, PlayerCombat>): Record<string, PlayerCombat> {
  const revived: Record<string, PlayerCombat> = {};
  for (const [id, p] of Object.entries(players)) {
    revived[id] = p.isGhost ? { ...p, hp: REVIVE_HP, isGhost: false } : p;
  }
  return revived;
}

// The room-loop reducer: start the dungeon, collect simultaneous answers,
// resolve a round (HP + monster damage), and roll into the next question,
// room, or game-over. Host-authoritative, same shape as Bomb Disarm's.
export function useDungeon({ roster, state, publish }: DungeonDeps) {
  function askQuestion(base: GameState, room: ActiveRoom): GameState {
    return {
      ...base,
      phase: 'question',
      room,
      answers: {},
      roundEndTimestamp: Date.now() + (room.isBoss ? BOSS_ANSWER_DURATION_MS : ANSWER_DURATION_MS),
      lastReveal: null,
    };
  }

  // ---- Host: the party leaves the assembly screen and the first room deals ----
  function startDungeon() {
    const players: Record<string, PlayerCombat> = {};
    roster.forEach((p) => { players[p.id] = { hp: STARTING_HP, score: 0, isGhost: false, items: 0 }; });

    const room = buildRoom(0, roster.length, []);
    publish(askQuestion({
      ...state,
      dungeonLength: DUNGEON_LENGTH,
      players,
      askedQuestionIds: [room.question.id],
      winnerIds: [],
    }, room));
  }

  // ---- Host: record one player's answer, resolving the round once everyone's in ----
  function submitAnswer(senderId: string | undefined, choiceIndex: number) {
    if (!senderId || state.phase !== 'question' || !state.room) return;
    if (state.answers[senderId] !== undefined) return; // no changing your mind

    const nextAnswers = { ...state.answers, [senderId]: choiceIndex };
    if (Object.keys(nextAnswers).length >= roster.length) {
      resolveRound({ ...state, answers: nextAnswers });
    } else {
      publish({ ...state, answers: nextAnswers });
    }
  }

  // ---- Host: the answer window ran out — resolve with whatever came in ----
  function timeoutRound() {
    if (state.phase !== 'question') return;
    resolveRound(state);
  }

  // ---- Host: score every answer, damage the wrong and the monster, hold on
  // the reveal for a beat, then roll into whatever's next ----
  function resolveRound(base: GameState) {
    const room = base.room;
    if (!room) return;
    const correctIndex = room.question.correctIndex;
    const damageDealt: Record<string, number> = {};
    const wardsUsed: string[] = [];
    let monsterDamage = 0;
    const nextPlayers: Record<string, PlayerCombat> = { ...base.players };

    roster.forEach((p) => {
      const current = nextPlayers[p.id] ?? { hp: 0, score: 0, isGhost: true, items: 0 };
      if (base.answers[p.id] === correctIndex) {
        const gained = room.isBoss ? BOSS_CORRECT_ANSWER_SCORE : 1;
        nextPlayers[p.id] = { ...current, score: current.score + gained };
        // Ghosts keep answering for points, but they're out of the fight —
        // their correct answers no longer land on the monster.
        if (!current.isGhost) monsterDamage += CORRECT_ANSWER_DAMAGE;
      } else if (!current.isGhost) {
        if (current.items > 0) {
          // A Ward takes the hit instead of their HP.
          wardsUsed.push(p.id);
          nextPlayers[p.id] = { ...current, items: current.items - 1 };
        } else {
          const nextHp = Math.max(0, current.hp - WRONG_ANSWER_DAMAGE);
          damageDealt[p.id] = WRONG_ANSWER_DAMAGE;
          nextPlayers[p.id] = { ...current, hp: nextHp, isGhost: nextHp <= 0 };
        }
      }
    });

    const nextMonsterHp = Math.max(0, room.monsterHp - monsterDamage);
    const monsterDefeated = nextMonsterHp <= 0;

    // Clearing a (non-boss) room drops loot for whoever's furthest behind —
    // a rubber-band so a rough run doesn't spiral. No loot at the boss;
    // the run's over either way.
    let lootRecipientId: string | null = null;
    if (monsterDefeated && !room.isBoss) {
      const eligible = roster.filter((p) => (nextPlayers[p.id]?.items ?? 0) < MAX_ITEMS);
      if (eligible.length > 0) {
        const lowestScore = Math.min(...eligible.map((p) => nextPlayers[p.id]?.score ?? 0));
        const recipient = eligible.find((p) => (nextPlayers[p.id]?.score ?? 0) === lowestScore)!;
        lootRecipientId = recipient.id;
        nextPlayers[recipient.id] = { ...nextPlayers[recipient.id], items: nextPlayers[recipient.id].items + 1 };
      }
    }

    const withReveal: GameState = {
      ...base,
      phase: 'reveal',
      players: nextPlayers,
      room: { ...room, monsterHp: nextMonsterHp },
      lastReveal: { correctIndex, answers: base.answers, damageDealt, monsterDamage, monsterDefeated, wardsUsed, lootRecipientId },
    };
    publish(withReveal);
    setTimeout(() => advanceAfterReveal(withReveal), REVEAL_DURATION_MS);
  }

  // ---- Host: the monster's still up -> another question; dead -> next room
  // or, at the boss, game over ----
  function advanceAfterReveal(base: GameState) {
    const room = base.room;
    if (!room) return;

    if (room.monsterHp > 0) {
      const question = pickQuestion(base.askedQuestionIds);
      return publish(askQuestion(
        { ...base, askedQuestionIds: [...base.askedQuestionIds, question.id] },
        { ...room, question },
      ));
    }

    if (room.isBoss) {
      const scores = roster.map((p) => base.players[p.id]?.score ?? 0);
      const topScore = Math.max(0, ...scores);
      const winnerIds = roster.filter((p) => (base.players[p.id]?.score ?? 0) === topScore).map((p) => p.id);
      return publish({ ...base, phase: 'game-over', room: null, winnerIds });
    }

    // The party presses on — clearing a room drags any ghosts back to their feet.
    const revivedPlayers = reviveGhosts(base.players);
    const nextRoom = buildRoom(room.index + 1, roster.length, base.askedQuestionIds);
    return publish(askQuestion(
      { ...base, players: revivedPlayers, askedQuestionIds: [...base.askedQuestionIds, nextRoom.question.id] },
      nextRoom,
    ));
  }

  return { startDungeon, submitAnswer, timeoutRound };
}
