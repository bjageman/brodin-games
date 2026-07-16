import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../../../shared/utils/cn';
import type { Card } from '../types';
import { CARD_META } from '../cards';
import { teamCountLabels } from '../constants';
import { CardArt, LightningBolt, WireIcon } from './BombArt';

export function BombCard({ card, faceUp, tappable, maxWidth, onTap }: {
  card: Card;
  faceUp: boolean;
  tappable?: boolean;
  maxWidth?: string;
  onTap?: () => void;
}) {
  const shown = faceUp || card.revealed;
  const meta = CARD_META[card.type];

  // Both faces are always in the DOM and a 3D rotation swaps which one faces the
  // viewer, so a card already dealt face-up (e.g. memorize) still gets to play
  // the flip once mounted, instead of just popping in already-turned.
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    if (!shown) {
      const raf = requestAnimationFrame(() => setFlipped(false));
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => setFlipped(true));
    return () => cancelAnimationFrame(raf);
  }, [shown]);

  return (
    <button
      type="button"
      disabled={!tappable}
      onClick={onTap}
      style={maxWidth ? { maxWidth, perspective: '600px' } : { perspective: '600px' }}
      className={cn(
        'relative h-full aspect-[1/1.75] min-w-0 shrink transition-transform',
        tappable && 'cursor-pointer hover:scale-[1.04] active:scale-95'
      )}
    >
      <div
        className={cn(
          'relative h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] [transform-style:preserve-3d]',
          flipped && '[transform:rotateY(180deg)]'
        )}
      >
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center rounded-xl border-2 border-bomb-cardEdge bg-bomb-card shadow-lg shadow-black/30 [backface-visibility:hidden]',
            tappable && 'ring-2 ring-bomb-bolt/70'
          )}
        >
          <span className="w-1/2 max-w-[46px]">
            <LightningBolt />
          </span>
        </span>
        <span className="absolute inset-0 flex h-full flex-col items-center gap-1.5 rounded-xl border-2 border-bomb-face/60 bg-bomb-face p-1.5 pt-2 shadow-lg shadow-black/30 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <span className="font-display text-[10px] font-black uppercase leading-tight tracking-wider text-white drop-shadow-[0_1px_1px_rgba(26,31,77,0.5)] sm:text-xs">
            {meta.title}
          </span>
          {card.type !== 'blank' && (
            <span className="w-[70%] max-w-[64px] shrink-0">
              <CardArt type={card.type} />
            </span>
          )}
          {meta.effect && (
            <span className="mt-auto px-0.5 text-left text-[7px] leading-[1.3] text-bomb-ink sm:text-[8px]">
              <span className="block font-black">{meta.effectLabel}:</span>
              <span className="block font-semibold">{meta.effect}</span>
            </span>
          )}
        </span>
      </div>
    </button>
  );
}

const HAND_GAP_PX = 10;

export function HandRow({ hand, faceUp, tappable, onTap }: {
  hand: Card[];
  faceUp: boolean;
  tappable: boolean;
  onTap?: (i: number) => void;
}) {
  // Cards are sized off the row's height to keep their shape, but a tall row on
  // a narrow phone would run them off the right edge — so also cap each card at
  // its equal share of the width.
  const maxWidth = `calc((100% - ${(hand.length - 1) * HAND_GAP_PX}px) / ${Math.max(hand.length, 1)})`;

  return (
    <div className="flex h-full items-stretch justify-center" style={{ gap: `${HAND_GAP_PX}px` }}>
      {hand.map((card, i) => (
        <BombCard
          key={i}
          card={card}
          faceUp={faceUp}
          maxWidth={maxWidth}
          tappable={tappable && !card.revealed}
          onTap={onTap ? () => onTap(i) : undefined}
        />
      ))}
    </div>
  );
}

export function TeamCounts({ playerCount, extraRebels = 0 }: { playerCount: number; extraRebels?: number }) {
  const { rebels, peacekeepers } = teamCountLabels(playerCount, extraRebels);
  return (
    <dl className="font-serifDisplay text-base font-bold leading-tight text-white sm:text-xl">
      <div className="flex gap-3">
        <dt className="w-28 sm:w-36">Rebels:</dt>
        <dd>{rebels}</dd>
      </div>
      <div className="flex gap-3">
        <dt className="w-28 sm:w-36">Peacekeepers:</dt>
        <dd>{peacekeepers}</dd>
      </div>
    </dl>
  );
}

export function WiresPanel({ wiresRevealed, target }: { wiresRevealed: number; target: number }) {
  return (
    <div className="rounded-tl-3xl bg-bomb-wire px-4 py-3 pr-6 sm:px-6 sm:py-4">
      <p className="font-display text-sm font-black tracking-wide text-white sm:text-lg">
        Wires Cut {wiresRevealed}/{target}:
      </p>
      <div className="mt-1 flex items-end gap-1 sm:gap-2">
        {Array.from({ length: target }).map((_, i) => (
          <span key={i} className="w-7 sm:w-10">
            <WireIcon cut={i < wiresRevealed} />
          </span>
        ))}
      </div>
    </div>
  );
}

const VERTICAL_TEXT = { writingMode: 'vertical-rl', transform: 'rotate(180deg)' } as const;

export function BoardFrame({ onQuit, children }: { onQuit: () => void; children: ReactNode }) {
  return (
    <div className="flex h-full w-full bg-bomb-bg text-white">
      <div className="flex w-8 shrink-0 flex-col items-center justify-between border-r-2 border-dashed border-white/60 py-3 sm:w-11">
        <p
          className="min-h-0 flex-1 font-display text-[11px] font-black uppercase tracking-[0.18em] sm:text-sm"
          style={VERTICAL_TEXT}
        >
          Bomb Defuse
        </p>
        <button
          type="button"
          onClick={onQuit}
          className="mt-2 shrink-0 font-display text-[11px] font-black uppercase tracking-[0.18em] transition-opacity hover:opacity-70 sm:text-xs"
          style={VERTICAL_TEXT}
        >
          ↓ Quit
        </button>
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
