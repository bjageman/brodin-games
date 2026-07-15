import { cn } from '../../../shared/utils/cn';
import type { PlayerInfo } from '../../../shared/types';
import type { ActiveRoom, PlayerCombat, RoundResult } from '../types';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

export default function RevealView({ room, reveal, roster, players }: {
  room: ActiveRoom;
  reveal: RoundResult;
  roster: PlayerInfo[];
  players: Record<string, PlayerCombat>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="rounded-xl border-2 border-quiz-gold bg-quiz-panel p-5 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-quiz-ink/60">The answer was</p>
        <p className="mt-1 font-display text-lg font-bold text-quiz-gold">
          {ANSWER_LETTERS[reveal.correctIndex]}. {room.question.choices[reveal.correctIndex]}
        </p>
      </div>

      {reveal.monsterDamage > 0 && (
        <p className="text-center text-sm font-bold text-quiz-ink">
          The {room.isBoss ? 'boss' : 'monster'} took <span className="text-quiz-danger">{reveal.monsterDamage}</span> damage
          {reveal.monsterDefeated && <span className="text-quiz-gold"> — defeated!</span>}
        </p>
      )}

      <div className="space-y-1.5">
        {roster.map((p) => {
          const chosen = reveal.answers[p.id];
          const wasCorrect = chosen === reveal.correctIndex;
          const isGhost = players[p.id]?.isGhost ?? false;
          return (
            <div
              key={p.id}
              className={cn(
                'flex items-center justify-between rounded-lg border-2 px-3 py-2 text-sm font-bold',
                isGhost ? 'border-quiz-ink/20 bg-quiz-ink/5 opacity-70 grayscale'
                  : wasCorrect ? 'border-quiz-hp/60 bg-quiz-hp/10' : 'border-quiz-danger/60 bg-quiz-danger/10'
              )}
            >
              <span className="truncate text-quiz-ink">{isGhost && '👻 '}{p.name}</span>
              <span className={wasCorrect ? 'text-quiz-hp' : 'text-quiz-danger'}>
                {wasCorrect ? '✓ Correct' : chosen === undefined ? '— No answer' : `✗ ${ANSWER_LETTERS[chosen]}`}
                {!wasCorrect && (players[p.id]?.hp ?? 0) === 0 && (reveal.damageDealt[p.id] ?? 0) > 0 && ' — turned into a ghost!'}
                {!wasCorrect && !isGhost && ` (−${reveal.damageDealt[p.id] ?? 0} HP)`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
