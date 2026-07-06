import { useMemo } from 'react';
import { useCountdown } from '../../../shared/hooks/useCountdown';
import { buildDropdownOptions } from '../utils/fallbackMerge';
import { CATEGORY_STYLES } from '../utils/categoryColors';
import { splitIntoSegments } from '../utils/templateSegments';
import { DEBUG_MODE } from '../../../shared/constants';
import type { MadLibTemplate, WordLibrary } from '../types';
import type { PlayerInfo } from '../../../shared/types';
import { cn } from '../../../shared/utils/cn';

interface Round2SheetProps {
  endTimestamp: number | null;
  template: MadLibTemplate;
  assignedLibrary: WordLibrary;
  roster: PlayerInfo[];
  answers: Record<string, string>;
  onAnswerChange: (blankId: string, value: string) => void;
  onSubmit: () => void;
}

export default function Round2Sheet({ endTimestamp, template, assignedLibrary, roster, answers, onAnswerChange, onSubmit }: Round2SheetProps) {
  const { msRemaining } = useCountdown(endTimestamp);
  const secondsLeft = endTimestamp === null ? 'Paused' : Math.ceil(msRemaining / 1000);
  // Pronoun options are always the roster of players in the game, never
  // typed/collected words — see buildDropdownOptions.
  const dropdownOptions = useMemo(
    () => buildDropdownOptions(assignedLibrary, template, roster.map((p) => p.name)),
    [assignedLibrary, template, roster]
  );
  const segments = useMemo(() => splitIntoSegments(template), [template]);
  const allAnswered = template.blanks.every((blank) => !!answers[blank.id]);

  const fillAll = () => {
    for (const blank of template.blanks) {
      const options = dropdownOptions[blank.id];
      if (options?.length) onAnswerChange(blank.id, options[Math.floor(Math.random() * options.length)]);
    }
  };

  return (
    <div className="w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto space-y-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-gray-400">Fill out your memo</p>
        <p className={cn("text-4xl font-display font-bold", typeof secondsLeft === 'number' && secondsLeft <= 10 ? "text-red-400" : "text-brodin-accent")}>
          {typeof secondsLeft === 'number' ? `${secondsLeft}s` : 'Paused'}
        </p>
        {DEBUG_MODE && (
          <button
            type="button"
            onClick={fillAll}
            className="mt-2 px-3 py-1 rounded-md border border-yellow-500/50 bg-yellow-500/10 text-yellow-400 text-xs font-mono font-bold"
          >
            FILL
          </button>
        )}
      </div>

      <div className="bg-brodin-panel border border-brodin-primary/30 rounded-xl p-4 space-y-3">
        <h3 className="font-display text-lg font-bold text-brodin-gold">{template.title}</h3>
        <p className="text-gray-200 leading-loose">
          {segments.map((seg, i) =>
            seg.kind === 'text' ? (
              <span key={i}>{seg.value}</span>
            ) : (
              <select
                key={i}
                value={answers[seg.id] ?? ''}
                onChange={(e) => onAnswerChange(seg.id, e.target.value)}
                className={cn(
                  "mx-1 inline-block rounded-md border px-2 py-1 font-semibold bg-gray-900 focus:outline-none focus:border-brodin-accent",
                  answers[seg.id]
                    ? cn(CATEGORY_STYLES[seg.category].border, CATEGORY_STYLES[seg.category].text)
                    : "border-brodin-primary/40 text-gray-400"
                )}
              >
                <option value="" disabled>{seg.category === 'pronoun' ? 'player' : seg.category}...</option>
                {dropdownOptions[seg.id]?.map((word) => (
                  <option key={word} value={word}>{word}</option>
                ))}
              </select>
            )
          )}
        </p>
      </div>

      <button
        onClick={onSubmit}
        disabled={!allAnswered}
        className="w-full bg-brodin-primary hover:bg-brodin-primaryDark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-3 font-bold transition-colors"
      >
        Submit
      </button>
    </div>
  );
}
