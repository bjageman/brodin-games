export const STARTING_HP = 3;
// The party panel always shows this many slots so the roster reads as a fixed
// set of seats — filled with a hero or left as an open space. Kept in sync
// with quiz-quest's maxPlayers in the games registry.
export const PARTY_SLOTS = 8;
// A wrong answer costs a flat amount of HP; Room/Monster effects (not yet
// built — see #79 follow-up) will multiply/modify this.
export const WRONG_ANSWER_DAMAGE = 1;
// Each correct answer deals this much to the room's monster.
export const CORRECT_ANSWER_DAMAGE = 1;
// A ghost (0 HP) is revived whenever the party clears a room, back up to
// this much HP — a fresh start, not a full heal (see #80).
export const REVIVE_HP = 1;

// Two equipment slots per player (#84). A Ward absorbs one wrong answer's
// damage before being consumed. Earned as room loot, going to whoever's
// furthest behind on points — a rubber-band to keep the party together.
export const MAX_ITEMS = 2;

export const REGULAR_ROOM_COUNT = 5;
// The boss has a bigger HP pool (more correct answers needed) and, per #82,
// two things that make it feel distinct rather than just "a bigger number":
// a tighter clock and a score bonus for landing a correct answer under pressure.
export const BOSS_HP_MULTIPLIER = 2;
export const BOSS_CORRECT_ANSWER_SCORE = 2;

export const ANSWER_DURATION_MS = 20000;
export const BOSS_ANSWER_DURATION_MS = 12000;
export const REVEAL_DURATION_MS = 4000;
