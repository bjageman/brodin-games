import type { ReactNode } from 'react';
import { cn } from '../../../shared/utils/cn';
import type { Card } from '../types';
import { CARD_META } from '../cards';
import { WIRE_WIN_THRESHOLD, teamCountLabels } from '../constants';
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

  return (
    <button
      type="button"
      disabled={!tappable}
      onClick={onTap}
      style={maxWidth ? { maxWidth } : undefined}
      className={cn(
        'relative h-full aspect-[1/1.75] min-w-0 shrink rounded-xl border-2 shadow-lg shadow-black/30 transition-transform',
        shown
          ? 'border-bomb-face/60 bg-bomb-face'
          : 'border-bomb-cardEdge bg-bomb-card',
        card.revealed && !faceUp && 'animate-cardFlip',
        tappable && 'cursor-pointer ring-2 ring-bomb-bolt/70 hover:scale-[1.04] active:scale-95'
      )}
    >
      {shown ? (
        <span className="flex h-full flex-col items-center gap-1.5 p-1.5 pt-2">
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
      ) : (
        <span className="flex h-full items-center justify-center">
          <span className="w-1/2 max-w-[46px]">
            <LightningBolt />
          </span>
        </span>
      )}
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

export function WiresPanel({ wiresRevealed }: { wiresRevealed: number }) {
  return (
    <div className="rounded-tl-3xl bg-bomb-wire px-4 py-3 pr-6 sm:px-6 sm:py-4">
      <p className="font-display text-sm font-black tracking-wide text-white sm:text-lg">
        Wires Cut {wiresRevealed}/{WIRE_WIN_THRESHOLD}:
      </p>
      <div className="mt-1 flex items-end gap-1 sm:gap-2">
        {Array.from({ length: WIRE_WIN_THRESHOLD }).map((_, i) => (
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
