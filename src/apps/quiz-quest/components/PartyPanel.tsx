import { cn } from '../../../shared/utils/cn';
import type { PlayerInfo } from '../../../shared/types';
import type { PlayerCombat } from '../types';
import { MAX_ITEMS, PARTY_SLOTS, STARTING_HP } from '../constants';
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
        'flex aspect-[4/3] flex-col border-2 bg-quiz-stone shadow-[0_2px_6px_rgba(0,0,0,0.5)]',
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

// An unfilled seat — a spot waiting for a player to drop in. Same footprint as
// a MemberCard so the roster grid stays a stable set of seats.
function OpenSlot() {
  return (
    <div className="flex aspect-[4/3] flex-col items-center justify-center border-2 border-dashed border-quiz-goldDark/50 bg-quiz-stone/25">
      <span className="font-pixelBlock text-[9px] uppercase tracking-wide text-quiz-ink/30">Open</span>
    </div>
  );
}

// The mockup's right-hand roster: a fixed grid of PARTY_SLOTS seats, always on
// screen, so everyone can watch each other's HP and loadout. Seats past the
// current party size render as open spaces rather than letting a small party
// stretch to fill the whole column.
export default function PartyPanel({ roster, players, playerId }: {
  roster: PlayerInfo[];
  players: Record<string, PlayerCombat>;
  playerId: string;
}) {
  return (
    <div className="grid grid-cols-2 content-start gap-2">
      {Array.from({ length: PARTY_SLOTS }, (_, i) => {
        const p = roster[i];
        return p
          ? <MemberCard key={p.id} name={p.name} index={i} combat={players[p.id]} isMe={p.id === playerId} />
          : <OpenSlot key={`open-${i}`} />;
      })}
    </div>
  );
}
