export const STARTING_HP = 3;
// A wrong answer costs a flat amount of HP; Room/Monster effects (not yet
// built — see #79 follow-up) will multiply/modify this.
export const WRONG_ANSWER_DAMAGE = 1;
// Each correct answer deals this much to the room's monster.
export const CORRECT_ANSWER_DAMAGE = 1;

export const REGULAR_ROOM_COUNT = 5;
// The boss just has a bigger HP pool — same fight, more correct answers needed.
export const BOSS_HP_MULTIPLIER = 2;

export const ANSWER_DURATION_MS = 20000;
export const REVEAL_DURATION_MS = 4000;
