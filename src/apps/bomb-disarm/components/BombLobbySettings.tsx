import { useState } from 'react';
import { cn } from '../../../shared/utils/cn';
import type { LobbyExtraProps } from '../../../shared/components/Lobby';
import { CARD_META, SPECIAL_CARD_TYPES } from '../cards';
import { maxSpecialsFor } from '../constants';
import type { SpecialCardType } from '../types';
import { loadSpecials, saveSpecials } from '../settings';
import { CardArt } from './BombArt';

export default function BombLobbySettings({ code, roster }: LobbyExtraProps) {
  const [selected, setSelected] = useState<SpecialCardType[]>(() => loadSpecials(code));

  const cap = maxSpecialsFor(Math.max(roster.length, 1));
  const inDeck = selected.slice(0, cap);
  const overCap = selected.length > cap;

  const toggle = (type: SpecialCardType) => {
    const next = selected.includes(type)
      ? selected.filter((t) => t !== type)
      : [...selected, type];
    setSelected(next);
    saveSpecials(code, next);
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 pb-4">
      <div className="rounded-2xl border-2 border-white/15 bg-bomb-board/70 p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-white">
            Special Cards
          </h2>
          <p className="text-xs font-semibold text-white/70">
            {inDeck.length} in the deck · they replace blanks
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {SPECIAL_CARD_TYPES.map((type) => {
            const on = selected.includes(type);
            const dropped = on && !inDeck.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggle(type)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-colors',
                  on
                    ? 'border-bomb-bolt bg-bomb-face text-white'
                    : 'border-white/15 bg-bomb-bg/60 text-white/50 hover:border-white/40',
                  dropped && 'border-bomb-rebel'
                )}
              >
                <span className={cn('w-8', !on && 'opacity-40 grayscale')}>
                  <CardArt type={type} />
                </span>
                <span className="text-center font-display text-[10px] font-black uppercase leading-tight tracking-wide">
                  {CARD_META[type].title}
                </span>
              </button>
            );
          })}
        </div>

        {overCap && (
          <p className="mt-3 text-xs font-bold text-bomb-rebel">
            A {roster.length}-player deck only has room for {cap}. The ones outlined in pink are
            sitting out — deselect them, or add players.
          </p>
        )}
      </div>
    </section>
  );
}
