import { cn } from '../../../shared/utils/cn';
import type { PlayerInfo } from '../../../shared/types';
import type { ActiveRoom, PlayerCombat } from '../types';
import { MAX_ITEMS, STARTING_HP } from '../constants';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

export default function QuestionView({
  room, dungeonLength, roster, players, playerId, myAnswer, answeredCount, secondsLeft, onAnswer,
}: {
  room: ActiveRoom;
  dungeonLength: number;
  roster: PlayerInfo[];
  players: Record<string, PlayerCombat>;
  playerId: string;
  myAnswer: number | undefined;
  answeredCount: number;
  secondsLeft: number;
  onAnswer: (index: number) => void;
}) {
  const myHp = players[playerId]?.hp ?? 0;
  const myIsGhost = players[playerId]?.isGhost ?? false;
  const myItems = players[playerId]?.items ?? 0;
  const monsterPct = Math.round((room.monsterHp / room.monsterMaxHp) * 100);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-quiz-gold">
        <span>{room.isBoss ? '👹 Boss Room · 2x Points' : `Room ${room.index + 1}/${dungeonLength}`}</span>
        <span className={cn(room.isBoss && secondsLeft <= 5 ? 'animate-pulse text-quiz-danger' : 'text-quiz-ink/70')}>
          ⏱ {secondsLeft}s
        </span>
      </div>

      <div className="rounded-lg border-2 border-quiz-gold bg-quiz-stone p-3">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide">
          <span>{room.isBoss ? 'The Boss' : 'Monster'}</span>
          <span>{room.monsterHp}/{room.monsterMaxHp} HP</span>
        </div>
        <div className="mt-1 h-2.5 w-full rounded-full bg-quiz-hpTrack">
          <div className="h-2.5 rounded-full bg-quiz-danger transition-all" style={{ width: `${monsterPct}%` }} />
        </div>
      </div>

      <div className="rounded-xl border-2 border-quiz-gold bg-quiz-panel p-5 text-center">
        <p className="font-display text-lg font-bold text-quiz-ink sm:text-xl">{room.question.question}</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {room.question.choices.map((choice, i) => {
          const chosen = myAnswer === i;
          return (
            <button
              key={i}
              type="button"
              disabled={myAnswer !== undefined}
              onClick={() => onAnswer(i)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border-2 p-3 text-left transition-transform',
                chosen ? 'border-quiz-gold bg-quiz-gold/20' : 'border-quiz-gold/40 bg-quiz-stone',
                myAnswer === undefined && 'hover:scale-[1.02] hover:border-quiz-gold'
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-quiz-gold text-xs font-black text-quiz-bg">
                {ANSWER_LETTERS[i]}
              </span>
              <span className="text-sm font-semibold text-quiz-ink">{choice}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-quiz-ink/70">
            <span>{myIsGhost ? '👻 Ghost' : 'Your HP'}</span>
            <span>{myIsGhost ? 'Answering for points' : `${myHp}/${STARTING_HP}`}</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-quiz-hpTrack">
            <div
              className={cn('h-2 rounded-full transition-all', myIsGhost ? 'bg-quiz-ink/30' : 'bg-quiz-hp')}
              style={{ width: `${myIsGhost ? 100 : Math.round((myHp / STARTING_HP) * 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center gap-1" title={`${myItems}/${MAX_ITEMS} Wards`}>
            {Array.from({ length: MAX_ITEMS }, (_, i) => (
              <span key={i} className={cn('text-sm', i < myItems ? 'opacity-100' : 'opacity-20 grayscale')}>🛡️</span>
            ))}
          </div>
        </div>
        <p className="shrink-0 text-xs font-bold uppercase tracking-wide text-quiz-ink/70">
          {myAnswer !== undefined ? 'Waiting on the party…' : 'Pick an answer'} · {answeredCount}/{roster.length}
        </p>
      </div>
    </div>
  );
}
