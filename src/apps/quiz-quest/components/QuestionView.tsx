import { cn } from '../../../shared/utils/cn';
import type { PlayerInfo } from '../../../shared/types';
import type { ActiveRoom, PlayerCombat } from '../types';
import BattleLayout from './BattleLayout';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

export default function QuestionView({
  room, dungeonLength, roster, players, playerId, myAnswer, answeredCount, secondsLeft, onAnswer, onMenu,
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
  onMenu: () => void;
}) {
  const locked = myAnswer !== undefined;

  return (
    <BattleLayout
      room={room}
      dungeonLength={dungeonLength}
      roster={roster}
      players={players}
      playerId={playerId}
      secondsLeft={secondsLeft}
      onMenu={onMenu}
    >
      <div className="flex flex-col gap-1.5">
        {room.question.choices.map((choice, i) => {
          const chosen = myAnswer === i;
          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => onAnswer(i)}
              className={cn(
                'flex items-center gap-3 border-2 px-3 py-2.5 text-left transition-colors',
                chosen
                  ? 'border-quiz-gold bg-quiz-gold/20'
                  : 'border-quiz-goldDark bg-quiz-stone',
                !locked && 'hover:border-quiz-gold hover:bg-quiz-stoneLight',
                locked && !chosen && 'opacity-60'
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-quiz-gold font-pixelBlock text-xs text-quiz-bg">
                {ANSWER_LETTERS[i]}
              </span>
              <span className="font-pixel text-base font-medium text-quiz-ink">{choice}</span>
            </button>
          );
        })}

        <p className="mt-0.5 text-center font-pixelBlock text-[10px] uppercase text-quiz-gold/80">
          {locked ? 'Waiting on the party' : 'Choose your answer'} · {answeredCount}/{roster.length} in
        </p>
      </div>
    </BattleLayout>
  );
}
