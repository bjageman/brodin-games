import { cn } from '../../../shared/utils/cn';
import type { ActiveRoom } from '../types';
import { monsterFor } from '../monsters';
import { roomBgFor } from '../rooms';

const PIXELATED = { imageRendering: 'pixelated' as const };

// The first-person "viewport" from the mockup: the monster floats in a
// pixel-art dungeon room, the question is overlaid across the top, and a thin
// bar tracks the monster's health along the bottom. This is the screen's hero.
export default function DungeonRoom({
  room, dungeonLength, secondsLeft,
}: {
  room: ActiveRoom;
  dungeonLength: number;
  secondsLeft?: number;
}) {
  const monsterPct = Math.round((room.monsterHp / room.monsterMaxHp) * 100);
  const lowTime = secondsLeft !== undefined && secondsLeft <= 5;

  return (
    <div className="relative aspect-[16/9] max-h-[50vh] w-full overflow-hidden rounded-md border-[3px] border-quiz-gold bg-black shadow-[0_0_0_2px_#000,0_8px_24px_rgba(0,0,0,0.6)]">
      {/* Room scene, blown up with crisp pixels and pooled in torch-lit shadow */}
      <img
        src={roomBgFor(room.index, room.isBoss)}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
        style={PIXELATED}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_45%,transparent_25%,rgba(0,0,0,0.55)_100%)]" />

      {/* The monster, bobbing over a soft cast shadow */}
      <div className="absolute inset-x-0 top-[42%] flex -translate-y-1/2 flex-col items-center">
        <img
          src={monsterFor(room.index, room.isBoss)}
          alt={room.isBoss ? 'The boss' : 'The monster'}
          className={cn('animate-monsterFloat drop-shadow-[0_6px_10px_rgba(0,0,0,0.7)]',
            room.isBoss ? 'h-40 w-40 sm:h-52 sm:w-52' : 'h-32 w-32 sm:h-40 sm:w-40')}
          style={PIXELATED}
        />
        <div className="mt-1 h-3 w-24 rounded-[50%] bg-black/50 blur-[6px]" />
      </div>

      {/* Question, painted across the top over a darkened band */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 via-black/60 to-transparent px-4 pb-8 pt-3">
        <p className="text-center font-pixelBlock text-sm leading-relaxed text-quiz-ink [text-shadow:2px_2px_0_#000] sm:text-base">
          {room.question.question}
        </p>
      </div>

      {/* Room counter + answer clock, top corners */}
      <span className="absolute left-2 top-2 font-pixelBlock text-[10px] text-quiz-gold [text-shadow:1px_1px_0_#000]">
        {room.isBoss ? 'BOSS' : `${room.index + 1}/${dungeonLength}`}
      </span>
      {secondsLeft !== undefined && (
        <span
          className={cn(
            'absolute right-2 top-2 font-pixelBlock text-[11px] [text-shadow:1px_1px_0_#000]',
            lowTime ? 'animate-pulse text-quiz-danger' : 'text-quiz-ink'
          )}
        >
          {secondsLeft}s
        </span>
      )}

      {/* Monster health, hugging the floor */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-6">
        <div className="mx-auto flex max-w-sm items-center gap-2">
          <span className="font-pixelBlock text-[9px] uppercase text-quiz-gold [text-shadow:1px_1px_0_#000]">
            {room.isBoss ? 'Boss' : 'Foe'}
          </span>
          <div className="h-2.5 flex-1 border border-black bg-quiz-hpTrack">
            <div className="h-full bg-quiz-danger transition-all" style={{ width: `${monsterPct}%` }} />
          </div>
          <span className="font-pixel text-[10px] font-semibold text-quiz-ink [text-shadow:1px_1px_0_#000]">
            {room.monsterHp}/{room.monsterMaxHp}
          </span>
        </div>
      </div>
    </div>
  );
}
