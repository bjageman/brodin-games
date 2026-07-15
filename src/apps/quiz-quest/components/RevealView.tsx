import { cn } from '../../../shared/utils/cn';
import type { PlayerInfo } from '../../../shared/types';
import type { ActiveRoom, PlayerCombat, RoundResult } from '../types';
import BattleLayout from './BattleLayout';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

export default function RevealView({ room, dungeonLength, reveal, roster, players, playerId, onMenu }: {
  room: ActiveRoom;
  dungeonLength: number;
  reveal: RoundResult;
  roster: PlayerInfo[];
  players: Record<string, PlayerCombat>;
  playerId: string;
  onMenu: () => void;
}) {
  return (
    <BattleLayout
      room={room}
      dungeonLength={dungeonLength}
      roster={roster}
      players={players}
      playerId={playerId}
      onMenu={onMenu}
    >
      <div className="flex flex-col gap-1.5">
        <div className="border-2 border-quiz-gold bg-quiz-panel px-3 py-2 text-center">
          <span className="font-pixelBlock text-[9px] uppercase text-quiz-ink/50">Correct answer</span>
          <p className="font-pixelBlock text-sm text-quiz-gold [text-shadow:1px_1px_0_#000]">
            {ANSWER_LETTERS[reveal.correctIndex]}. {room.question.choices[reveal.correctIndex]}
          </p>
        </div>

        <p className="text-center font-pixel text-sm text-quiz-ink">
          {reveal.monsterDamage > 0
            ? <>The {room.isBoss ? 'boss' : 'foe'} took <span className="font-semibold text-quiz-danger">{reveal.monsterDamage}</span> damage
              {reveal.monsterDefeated && <span className="text-quiz-gold"> — defeated!</span>}</>
            : <span className="text-quiz-ink/60">The {room.isBoss ? 'boss' : 'foe'} shrugs it off.</span>}
          {reveal.lootRecipientId && (
            <span className="block text-quiz-gold">
              🛡️ {roster.find((p) => p.id === reveal.lootRecipientId)?.name} found a Ward!
            </span>
          )}
        </p>

        <div className="flex flex-col gap-1">
          {roster.map((p) => {
            const chosen = reveal.answers[p.id];
            const wasCorrect = chosen === reveal.correctIndex;
            const isGhost = players[p.id]?.isGhost ?? false;
            const usedWard = reveal.wardsUsed.includes(p.id);
            return (
              <div
                key={p.id}
                className={cn(
                  'flex items-center justify-between border-2 px-2.5 py-1.5 font-pixel text-sm',
                  isGhost ? 'border-quiz-ink/20 bg-quiz-ink/5 opacity-70 grayscale'
                    : usedWard ? 'border-quiz-gold/60 bg-quiz-gold/10'
                      : wasCorrect ? 'border-quiz-hp/60 bg-quiz-hp/10' : 'border-quiz-danger/60 bg-quiz-danger/10'
                )}
              >
                <span className="truncate text-quiz-ink">{isGhost && '👻 '}{p.name}</span>
                <span className={cn('font-semibold', usedWard ? 'text-quiz-gold' : wasCorrect ? 'text-quiz-hp' : 'text-quiz-danger')}>
                  {wasCorrect ? '✓' : chosen === undefined ? '— no answer' : `✗ ${ANSWER_LETTERS[chosen]}`}
                  {usedWard && ' 🛡️ blocked'}
                  {!wasCorrect && !isGhost && !usedWard && ` −${reveal.damageDealt[p.id] ?? 0}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </BattleLayout>
  );
}
