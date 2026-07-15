// Lobby player tag styled as a sheriff-style six-point badge, in place of the
// shared lobby's generic sticky notes — matches the bomb-squad theme.

const STAR_POINTS = '70,4 85,44 127,37 100,70 127,103 85,96 70,136 55,96 13,103 40,70 13,37 55,44';

const GOLD = { fill: '#f0c94a', edge: '#a86f16', ribbon: '#2a2005' };
const SILVER = { fill: '#dbe1ea', edge: '#7c8494', ribbon: '#20242e' };

const ROTATIONS = [-6, 5, -4, 6, -5, 4, -3, 5];

export default function BombBadge({ name, index }: { name: string; index: number }) {
  const tone = index % 2 === 0 ? GOLD : SILVER;
  const rot = ROTATIONS[index % ROTATIONS.length];

  return (
    <div
      className="animate-notePop relative flex items-center justify-center"
      style={{ width: 132, height: 132, transform: `rotate(${rot}deg)` }}
    >
      <svg viewBox="0 0 140 140" className="absolute inset-0 h-full w-full drop-shadow-[0_4px_5px_rgba(0,0,0,0.45)]">
        <polygon points={STAR_POINTS} fill={tone.edge} opacity="0.55" transform="translate(3,5)" />
        <polygon points={STAR_POINTS} fill={tone.fill} stroke={tone.edge} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="70" cy="70" r="8" fill={tone.edge} opacity="0.5" />
        <rect x="42" y="58" width="56" height="24" rx="3" fill={tone.ribbon} opacity="0.94" />
      </svg>
      <span className="relative z-10 max-w-[46px] break-words text-center font-display text-[9px] font-extrabold uppercase leading-tight tracking-wide text-white">
        {name}
      </span>
    </div>
  );
}
