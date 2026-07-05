import type { CSSProperties } from 'react';

// Playful "scattered notes on a board" treatment for the lobby. Each joining
// player is drawn as one of a handful of sticky-note shapes (square, dotted
// circle, spiral notebook page, pennant, cloud, heart) that pops in.

const INK = '#2b2f74';

interface NoteVariant {
  /** Card fill color. */
  color: string;
  /** Fixed footprint so clip-path paths line up. */
  width: number;
  height: number;
  /** Optional clip-path (pennant / cloud / heart). */
  clip?: string;
  /** Extra background layers (lines, dots, grid) drawn over the fill. */
  pattern?: CSSProperties;
  radius?: string;
  /** Decoration rendered on top: tape, spiral holes, peeling corner. */
  decoration?: 'tapeTop' | 'tapeCorner' | 'spiral' | 'peel';
}

const lines = (rgba: string, gap = 20): CSSProperties => ({
  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${gap - 1}px, ${rgba} ${gap - 1}px ${gap}px)`,
});

const dots = (rgba: string): CSSProperties => ({
  backgroundImage: `radial-gradient(${rgba} 2.2px, transparent 2.6px)`,
  backgroundSize: '15px 15px',
});

const grid = (rgba: string): CSSProperties => ({
  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 15px, ${rgba} 15px 16px), repeating-linear-gradient(to right, transparent 0 15px, ${rgba} 15px 16px)`,
});

const VARIANTS: NoteVariant[] = [
  // 0 — purple square sticky note, ruled, tape on top
  {
    color: '#6c63e8',
    width: 132,
    height: 132,
    radius: '14px',
    pattern: lines('rgba(255,255,255,0.18)'),
    decoration: 'tapeTop',
  },
  // 1 — yellow dotted circle sticker, peeling corner
  {
    color: '#ffc93c',
    width: 132,
    height: 132,
    radius: '9999px',
    pattern: dots('rgba(255,255,255,0.4)'),
    decoration: 'peel',
  },
  // 2 — orange spiral-bound notebook page
  {
    color: '#ff7a4d',
    width: 150,
    height: 122,
    radius: '6px',
    pattern: lines('rgba(255,255,255,0.28)'),
    decoration: 'spiral',
  },
  // 3 — yellow pennant / badge, pointed bottom
  {
    color: '#ffc93c',
    width: 128,
    height: 144,
    clip: 'polygon(0 0, 100% 0, 100% 76%, 50% 100%, 0 76%)',
    pattern: lines('rgba(255,255,255,0.28)'),
  },
  // 4 — purple cloud, dotted, tape on top
  {
    color: '#6c63e8',
    width: 158,
    height: 120,
    clip: 'path("M40 108 C 18 108 8 92 16 78 C 6 66 16 48 34 50 C 36 30 66 26 76 42 C 88 24 122 28 124 52 C 146 50 152 76 134 84 C 146 100 128 116 108 108 C 96 122 54 122 40 108 Z")',
    pattern: dots('rgba(255,255,255,0.32)'),
    decoration: 'tapeTop',
  },
  // 5 — yellow heart, grid pattern, tape corner
  {
    color: '#ffc93c',
    width: 148,
    height: 132,
    clip: 'path("M74 126 C 26 92 8 66 8 42 C 8 22 24 10 42 10 C 56 10 68 18 74 30 C 80 18 92 10 106 10 C 124 10 140 22 140 42 C 140 66 122 92 74 126 Z")',
    pattern: grid('rgba(255,255,255,0.22)'),
    decoration: 'tapeCorner',
  },
];

const ROTATIONS = [-5, 4, -3, 5, -4, 3, -2, 4];

function Decoration({ kind }: { kind: NoteVariant['decoration'] }) {
  if (kind === 'tapeTop') {
    return (
      <span
        className="absolute -top-2 left-1/2 h-5 w-12 -translate-x-1/2 -rotate-6 rounded-[3px]"
        style={{ backgroundColor: '#ff8a5c', opacity: 0.92 }}
      />
    );
  }
  if (kind === 'tapeCorner') {
    return (
      <span
        className="absolute -left-2 -top-1 h-5 w-11 rotate-[-38deg] rounded-[3px]"
        style={{ backgroundColor: INK, opacity: 0.9 }}
      />
    );
  }
  if (kind === 'peel') {
    return (
      <span
        className="absolute bottom-0 right-0 h-7 w-7"
        style={{
          backgroundColor: INK,
          borderTopLeftRadius: '14px',
          clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
        }}
      />
    );
  }
  if (kind === 'spiral') {
    return (
      <span className="absolute left-1.5 top-2 flex h-[calc(100%-16px)] flex-col justify-between">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full ring-2" style={{ color: INK, backgroundColor: '#ffe1c2' }} />
        ))}
      </span>
    );
  }
  return null;
}

export default function PlayerNote({ name, index }: { name: string; index: number }) {
  const v = VARIANTS[index % VARIANTS.length];
  const rot = ROTATIONS[index % ROTATIONS.length];

  return (
    <div
      className="animate-notePop relative flex items-center justify-center"
      style={{ ['--note-rot' as string]: `${rot}deg`, transform: `rotate(${rot}deg)`, width: v.width, height: v.height }}
    >
      {/* drop shadow layer (offset, matches ink) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: INK,
          borderRadius: v.radius,
          clipPath: v.clip,
          transform: 'translate(4px, 6px)',
          opacity: 0.28,
        }}
      />
      {/* the note itself */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: v.color, borderRadius: v.radius, clipPath: v.clip }}
      />
      {v.pattern && (
        <div
          className="absolute inset-0"
          style={{ ...v.pattern, borderRadius: v.radius, clipPath: v.clip }}
        />
      )}
      <Decoration kind={v.decoration} />
      <span className="relative z-10 max-w-[85%] break-words px-2 text-center font-display text-sm font-extrabold uppercase leading-tight tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
        {name}
      </span>
    </div>
  );
}
