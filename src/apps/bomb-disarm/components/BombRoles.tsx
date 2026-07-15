import { cn } from '../../../shared/utils/cn';
import type { Role, SpecialRole } from '../types';
import { SPECIAL_ROLE_META } from '../roles';

const OVERLAY = 'absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-bomb-bg/92 p-4 backdrop-blur-sm';

export function RoleBadge({ role, special }: { role: Role | undefined; special?: SpecialRole }) {
  if (!role) return null;
  const rebel = role === 'rebel';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-[10px] font-black uppercase tracking-widest sm:text-xs',
        rebel ? 'border-bomb-rebel bg-bomb-rebel/15 text-bomb-rebel' : 'border-bomb-wire bg-bomb-wire/20 text-white'
      )}
    >
      {special ? `${SPECIAL_ROLE_META[special].icon} ${SPECIAL_ROLE_META[special].title}` : rebel ? '🧨 Rebel' : '🛡️ Peacekeeper'}
    </span>
  );
}

export function RoleCard({ role, special }: { role: Role | undefined; special?: SpecialRole }) {
  const rebel = role === 'rebel';
  const meta = special ? SPECIAL_ROLE_META[special] : null;
  return (
    <div
      className={cn(
        'space-y-4 rounded-3xl border p-6 shadow-2xl sm:p-8',
        rebel ? 'border-bomb-rebel bg-bomb-rebel/15' : 'border-bomb-wire bg-bomb-wire/20'
      )}
    >
      <span className="text-5xl">{meta ? meta.icon : rebel ? '🧨' : '🛡️'}</span>
      <h3 className={cn('font-display text-2xl font-black uppercase tracking-widest sm:text-3xl', rebel ? 'text-bomb-rebel' : 'text-white')}>
        {meta ? meta.title : rebel ? 'Rebel' : 'Peacekeeper'}
      </h3>
      {meta && (
        <p className={cn('font-display text-[10px] font-black uppercase tracking-widest', rebel ? 'text-bomb-rebel/80' : 'text-white/70')}>
          {rebel ? 'Rebel' : 'Peacekeeper'}
        </p>
      )}
      <p className="text-sm leading-relaxed text-gray-200">
        {meta
          ? meta.blurb
          : rebel
            ? 'Sabotage the disarm. You win the moment a bomb is revealed — steer the table toward it.'
            : 'Disarm the bomb. Reveal 6 cut wires before any bomb turns up.'}
      </p>
    </div>
  );
}

// A bomb is face-up on the table and the Folk Hero is the only thing between it
// and a rebel win.
export function RescuePrompt({ bombOwnerName, onChoose }: {
  bombOwnerName: string;
  onChoose: (save: boolean) => void;
}) {
  return (
    <div className={OVERLAY}>
      <span className="text-4xl">💥</span>
      <h3 className="text-center font-display text-sm font-black uppercase tracking-widest text-bomb-rebel sm:text-base">
        A bomb turned up on {bombOwnerName}
      </h3>
      <p className="max-w-md text-center text-xs text-gray-300 sm:text-sm">
        You can reveal yourself as the Folk Hero and keep the game alive — but you'll take no more
        turns. Your cards stay on the table.
      </p>
      <div className="mt-1 flex gap-3">
        <button
          type="button"
          onClick={() => onChoose(true)}
          className="rounded-full bg-bomb-bolt px-5 py-2 font-display text-xs font-black uppercase tracking-wider text-bomb-ink transition-transform hover:scale-105 sm:text-sm"
        >
          🦸 Save the game
        </button>
        <button
          type="button"
          onClick={() => onChoose(false)}
          className="rounded-full border-2 border-white/30 px-5 py-2 font-display text-xs font-black uppercase tracking-wider text-gray-200 transition-colors hover:border-bomb-rebel hover:text-bomb-rebel sm:text-sm"
        >
          Let it blow
        </button>
      </div>
    </div>
  );
}

// Deliberately vague: nobody but the Folk Hero knows a Folk Hero is even in play.
export function RescueWaiting() {
  return (
    <div className={OVERLAY}>
      <span className="animate-pulse text-4xl">💥</span>
      <h3 className="text-center font-display text-sm font-black uppercase tracking-widest text-bomb-rebel sm:text-base">
        A bomb turned up
      </h3>
      <p className="max-w-md text-center text-xs text-gray-300 sm:text-sm">
        Hold your breath — someone at this table might still be able to stop it.
      </p>
    </div>
  );
}

// The Opportunist's turn-time action: flip the card, pick a side, in the open.
export function DeclarePrompt({ onDeclare }: { onDeclare: (team: Role) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-display text-[10px] font-black uppercase tracking-widest text-bomb-bolt">
        🎭 Flip your card:
      </span>
      <button
        type="button"
        onClick={() => onDeclare('rebel')}
        className="rounded-full border-2 border-bomb-rebel bg-bomb-rebel/15 px-3 py-1 font-display text-[10px] font-black uppercase tracking-wider text-bomb-rebel transition-transform hover:scale-105"
      >
        🧨 Rebel
      </button>
      <button
        type="button"
        onClick={() => onDeclare('peacekeeper')}
        className="rounded-full border-2 border-bomb-wire bg-bomb-wire/20 px-3 py-1 font-display text-[10px] font-black uppercase tracking-wider text-white transition-transform hover:scale-105"
      >
        🛡️ Peacekeeper
      </button>
    </div>
  );
}
