import { cn } from '../../../shared/utils/cn';
import type { PlayerInfo } from '../../../shared/types';
import type { PlayerCombat } from '../types';
import { MAX_ITEMS, STARTING_HP } from '../constants';
import { portraitFor } from '../portraits';

// The mockup keeps every teammate's portrait/HP/items on screen throughout
// the fight, not just in the lobby — this is that strip, compacted down for
// a phone-width column.
export default function PartyStatusBar({ roster, players, playerId }: {
  roster: PlayerInfo[];
  players: Record<string, PlayerCombat>;
  playerId: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
      {roster.map((p, i) => {
        const combat = players[p.id];
        const hp = combat?.hp ?? STARTING_HP;
        const isGhost = combat?.isGhost ?? false;
        const items = combat?.items ?? 0;
        const isMe = p.id === playerId;
        return (
          <div
            key={p.id}
            className={cn(
              'overflow-hidden rounded-md border-2 bg-quiz-stone',
              isGhost ? 'border-quiz-ink/20 opacity-60 grayscale' : isMe ? 'border-quiz-gold' : 'border-quiz-gold/40'
            )}
          >
            <img src={portraitFor(i)} alt="" className="aspect-square w-full object-cover" />
            <div className="px-1 py-1">
              <p className="truncate text-[9px] font-display font-bold uppercase tracking-wide text-quiz-ink">
                {p.name}
              </p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-quiz-hpTrack">
                <div
                  className={cn('h-1.5 rounded-full transition-all', isGhost ? 'bg-quiz-ink/30' : 'bg-quiz-hp')}
                  style={{ width: `${isGhost ? 100 : Math.round((hp / STARTING_HP) * 100)}%` }}
                />
              </div>
              <div className="mt-1 flex gap-0.5" title={`${items}/${MAX_ITEMS} Wards`}>
                {Array.from({ length: MAX_ITEMS }, (_, idx) => (
                  <span key={idx} className={cn('text-[8px] leading-none', idx < items ? 'opacity-100' : 'opacity-20 grayscale')}>
                    🛡️
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
