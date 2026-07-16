// Lobby player tag: the bomb-squad shield crest (rendered from
// Design Docs/Bomb Defuse/Player Badge → public/games/bomb-player-badge.png),
// with the player's name across the front. Replaces the shared lobby's
// generic sticky notes to match the bomb-squad theme.

// A little scatter of tilts so a row of shields reads as pinned-up, not a grid.
const ROTATIONS = [-6, 5, -4, 6, -5, 4, -3, 5];

export default function BombBadge({ name, index }: { name: string; index: number }) {
  const rot = ROTATIONS[index % ROTATIONS.length];

  return (
    <div
      className="animate-notePop relative flex items-center justify-center"
      style={{ width: 112, height: 132, transform: `rotate(${rot}deg)` }}
    >
      <img
        src="/games/bomb-player-badge.png"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_4px_5px_rgba(0,0,0,0.45)]"
      />
      {/* Name sits in the shield's navy field — nudged up from dead-centre so it
          lands above the crest's point rather than in the taper. */}
      <span className="relative z-10 -mt-2 max-w-[68px] break-words px-1 text-center font-display text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.75)]">
        {name}
      </span>
    </div>
  );
}
