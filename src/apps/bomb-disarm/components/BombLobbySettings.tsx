import { useState, type ReactNode } from 'react';
import { cn } from '../../../shared/utils/cn';
import type { LobbyExtraProps } from '../../../shared/components/Lobby';
import { CARD_META, SPECIAL_CARD_TYPES } from '../cards';
import { maxSpecialsFor } from '../constants';
import { SPECIAL_ROLES, SPECIAL_ROLE_META, maxSpecialRolesFor } from '../roles';
import type { SpecialCardType, SpecialRole } from '../types';
import { loadSpecialRoles, loadSpecials, saveSpecialRoles, saveSpecials } from '../settings';
import { CardArt } from './BombArt';

interface Option<T> {
  value: T;
  label: string;
  description: string;
  art: ReactNode;
}

function Picker<T extends string>({ title, hint, options, selected, cap, playerCount, unit, onToggle }: {
  title: string;
  hint: string;
  options: Option<T>[];
  selected: T[];
  cap: number;
  playerCount: number;
  unit: string;
  onToggle: (value: T) => void;
}) {
  const active = selected.slice(0, cap);
  const overCap = selected.length > cap;

  return (
    <div className="rounded-2xl border-2 border-white/15 bg-bomb-board/70 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-white">{title}</h2>
        <p className="text-xs font-semibold text-white/70">
          {active.length} {unit} · {hint}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((opt) => {
          const on = selected.includes(opt.value);
          const droppedForSpace = on && !active.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={cn(
                'flex items-start gap-2.5 rounded-xl border-2 p-2.5 text-left transition-colors',
                on ? 'border-bomb-bolt bg-bomb-face' : 'border-white/15 bg-bomb-bg/60 hover:border-white/40',
                droppedForSpace && 'border-bomb-rebel'
              )}
            >
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center', !on && 'opacity-40 grayscale')}>
                {opt.art}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn(
                  'block font-display text-[11px] font-black uppercase leading-tight tracking-wide',
                  on ? 'text-white' : 'text-white/60'
                )}>
                  {opt.label}
                </span>
                <span className={cn(
                  'mt-0.5 block text-[10px] font-semibold leading-snug',
                  on ? 'text-bomb-ink' : 'text-white/45'
                )}>
                  {opt.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {overCap && (
        <p className="mt-3 text-xs font-bold text-bomb-rebel">
          A {playerCount}-player game only has room for {cap}. The ones outlined in pink are sitting
          out — deselect them, or add players.
        </p>
      )}
    </div>
  );
}

export default function BombLobbySettings({ code, roster }: LobbyExtraProps) {
  const [cards, setCards] = useState<SpecialCardType[]>(() => loadSpecials(code));
  const [roles, setRoles] = useState<SpecialRole[]>(() => loadSpecialRoles(code));
  const playerCount = Math.max(roster.length, 1);

  const toggle = <T extends string>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 pb-4">
      <Picker
        title="Special Cards"
        hint="they replace blanks"
        unit="in the deck"
        playerCount={playerCount}
        cap={maxSpecialsFor(playerCount)}
        selected={cards}
        options={SPECIAL_CARD_TYPES.map((t) => ({
          value: t,
          label: CARD_META[t].title,
          description: CARD_META[t].effect ?? '',
          art: <CardArt type={t} />,
        }))}
        onToggle={(t) => {
          const next = toggle(cards, t);
          setCards(next);
          saveSpecials(code, next);
        }}
      />

      <Picker
        title="Special Roles"
        hint="they take a peacekeeper's seat"
        unit="in play"
        playerCount={playerCount}
        cap={maxSpecialRolesFor(playerCount)}
        selected={roles}
        options={SPECIAL_ROLES.map((r) => ({
          value: r,
          label: SPECIAL_ROLE_META[r].title,
          description: SPECIAL_ROLE_META[r].blurb,
          art: <span className="text-2xl leading-none">{SPECIAL_ROLE_META[r].icon}</span>,
        }))}
        onToggle={(r) => {
          const next = toggle(roles, r);
          setRoles(next);
          saveSpecialRoles(code, next);
        }}
      />
    </section>
  );
}
