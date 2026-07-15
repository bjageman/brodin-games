import { cn } from '../../../shared/utils/cn';
import type { PlayerInfo } from '../../../shared/types';
import type { PlayerCombat } from '../types';
import { MAX_ITEMS, STARTING_HP } from '../constants';
import { portraitFor } from '../portraits';

// One party member, styled after the mockup's roster cards: a name plate, the
// portrait beside its equipped-item slots, and an HP bar along the bottom.
function MemberCard({ name, index, combat, isMe }: {
  name: string;
  index: number;
  combat: PlayerCombat | undefined;
  isMe: boolean;
}) {
  const hp = combat?.hp ?? STARTING_HP;
  const isGhost = combat?.isGhost ?? false;
  const items = combat?.items ?? 0;

  return (
    <div
      className={cn(
        'flex h-full flex-col border-2 bg-quiz-stone shadow-[0_2px_6px_rgba(0,0,0,0.5)]',
        isMe ? 'border-quiz-gold' : 'border-quiz-goldDark',
        isGhost && 'opacity-60 grayscale'
      )}
    >
      <div className="flex items-center gap-1 bg-black/45 px-1.5 py-1">
        <p className="truncate font-pixelBlock text-[10px] uppercase leading-none text-quiz-ink">{name}</p>
        {isGhost && <span className="text-[10px] leading-none">👻</span>}
      </div>

      <div className="flex min-h-0 flex-1 gap-1 p-1">
        <img
          src={portraitFor(index)}
          alt=""
          aria-hidden
          className="h-full w-2/3 border border-black object-cover"
        />
        <div className="flex flex-1 flex-col gap-1">
          {Array.from({ length: MAX_ITEMS }, (_, i) => (
            <div
              key={i}
              className="flex flex-1 items-center justify-center border border-black bg-quiz-panel/70 text-xl"
              title={i < items ? 'Ward equipped' : 'Empty slot'}
            >
              {i < items ? '🛡️' : ''}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 px-1.5 pb-1">
        <span className="font-pixelBlock text-[8px] text-quiz-gold">HP</span>
        <div className="h-2 flex-1 border border-black bg-quiz-hpTrack">
          <div
            className={cn('h-full transition-all', isGhost ? 'bg-quiz-ink/30' : 'bg-quiz-hp')}
            style={{ width: `${isGhost ? 100 : Math.round((hp / STARTING_HP) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// The mockup's right-hand roster: the whole party, always on screen, in a
// two-column grid so everyone can watch each other's HP and loadout.
export default function PartyPanel({ roster, players, playerId }: {
  roster: PlayerInfo[];
  players: Record<string, PlayerCombat>;
  playerId: string;
}) {
  return (
    <div className="grid h-full grid-cols-2 auto-rows-fr gap-2">
      {roster.map((p, i) => (
        <MemberCard key={p.id} name={p.name} index={i} combat={players[p.id]} isMe={p.id === playerId} />
      ))}
    </div>
  );
}
