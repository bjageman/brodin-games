// Pixel-art dungeon room backgrounds (Design Docs/Quiz Quest/IMG_4822.png,
// a 4x3 sheet split into twelve 128x128 tiles). The monster floats in front
// of one of these; the boss always descends into the demon altar.
const REGULAR_ROOMS = [
  'standing_stones', 'arcane_tome', 'ice_crystals', 'pentagram_shrine',
  'firepit', 'ritual_circle', 'portal', 'ruby_crystal',
  'forest_shrine', 'lava_cavern', 'stone_guardian',
] as const;

const BOSS_ROOM = 'demon_altar';

// Deterministic by room index so every client renders the same room for a
// given dungeon position without syncing a choice over the wire.
export function roomBgFor(roomIndex: number, isBoss: boolean): string {
  const name = isBoss ? BOSS_ROOM : REGULAR_ROOMS[roomIndex % REGULAR_ROOMS.length];
  return `/quiz-quest/rooms/${name}.png`;
}
