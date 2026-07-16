// Pixel-art monster sprites (Design Docs/Quiz Quest/Monsters — Pixel Material
// Studio free sample packs, licensed for commercial/non-commercial game
// products, editing and resizing allowed).
//
// Ordered weakest -> nastiest so the party climbs a difficulty ramp on the way
// down: the dungeon deals rooms 0..REGULAR_ROOM_COUNT-1 in order, so room 0
// always opens on the slime and the last regular room lands on the wendigo,
// right before the boss. A few extra beyond REGULAR_ROOM_COUNT give headroom
// if the dungeon ever grows (monsterFor cycles with `%`).
const REGULAR_MONSTERS = [
  'slime', 'goblin', 'imp', 'harpy', 'sahagin', 'cockatrice', 'zombie', 'wendigo',
] as const;

// The dungeon has a single boss (the run's finale, always the last room), so
// it gets one deliberate, iconic sprite rather than a rotating pick — the
// Demon Lord always waits at the bottom.
const BOSS_MONSTER = 'demon_lord';

// Deterministic by room index so every client renders the same monster for a
// given room without syncing a choice over the wire.
export function monsterFor(roomIndex: number, isBoss: boolean): string {
  const name = isBoss ? BOSS_MONSTER : REGULAR_MONSTERS[roomIndex % REGULAR_MONSTERS.length];
  return `/quiz-quest/monsters/${name}.png`;
}
