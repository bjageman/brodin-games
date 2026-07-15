import type { PlayerInfo } from '../../shared/types';
import { ANSWER_DURATION_MS, CORRECT_ANSWER_DAMAGE, REVEAL_DURATION_MS, STARTING_HP, WRONG_ANSWER_DAMAGE } from './constants';
import { buildRoom, DUNGEON_LENGTH, pickQuestion } from './dungeon';
import type { ActiveRoom, GameState, PlayerCombat } from './types';

interface DungeonDeps {
  roster: PlayerInfo[];
  state: GameState;
  publish: (next: GameState) => void;
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
      roundEndTimestamp: Date.now() + ANSWER_DURATION_MS,
      revealEndTimestamp: null,
      lastReveal: null,
    };
  }

  // ---- Host: the party leaves the assembly screen and the first room deals ----
  function startDungeon() {
    const players: Record<string, PlayerCombat> = {};
    roster.forEach((p) => { players[p.id] = { hp: STARTING_HP, score: 0 }; });

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
    let monsterDamage = 0;
    const nextPlayers: Record<string, PlayerCombat> = { ...base.players };

    roster.forEach((p) => {
      const current = nextPlayers[p.id] ?? { hp: 0, score: 0 };
      if (base.answers[p.id] === correctIndex) {
        monsterDamage += CORRECT_ANSWER_DAMAGE;
        nextPlayers[p.id] = { ...current, score: current.score + 1 };
      } else {
        damageDealt[p.id] = WRONG_ANSWER_DAMAGE;
        nextPlayers[p.id] = { ...current, hp: Math.max(0, current.hp - WRONG_ANSWER_DAMAGE) };
      }
    });

    const nextMonsterHp = Math.max(0, room.monsterHp - monsterDamage);
    const monsterDefeated = nextMonsterHp <= 0;

    const withReveal: GameState = {
      ...base,
      phase: 'reveal',
      players: nextPlayers,
      room: { ...room, monsterHp: nextMonsterHp },
      lastReveal: { correctIndex, answers: base.answers, damageDealt, monsterDamage, monsterDefeated },
      revealEndTimestamp: Date.now() + REVEAL_DURATION_MS,
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
      return publish({ ...base, phase: 'game-over', room: null, winnerIds, revealEndTimestamp: null });
    }

    const nextRoom = buildRoom(room.index + 1, roster.length, base.askedQuestionIds);
    return publish(askQuestion({ ...base, askedQuestionIds: [...base.askedQuestionIds, nextRoom.question.id] }, nextRoom));
  }

  // ---- Host: the reveal window ran out — advance to the next room/question ----
  function timeoutReveal() {
    if (state.phase !== 'reveal') return;
    advanceAfterReveal(state);
  }

  return { startDungeon, submitAnswer, timeoutRound, timeoutReveal };
}
