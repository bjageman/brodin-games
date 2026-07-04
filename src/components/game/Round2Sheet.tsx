import { useMemo } from 'react';
import { useCountdown } from '../../hooks/useCountdown';
import { buildDropdownOptions } from '../../utils/fallbackMerge';
import type { MadLibTemplate, WordLibrary } from '../../types';
import { cn } from '../../utils/cn';

interface Round2SheetProps {
  endTimestamp: number;
  template: MadLibTemplate;
  assignedLibrary: WordLibrary;
  answers: Record<string, string>;
  onAnswerChange: (blankId: string, value: string) => void;
}

export default function Round2Sheet({ endTimestamp, template, assignedLibrary, answers, onAnswerChange }: Round2SheetProps) {
  const { msRemaining } = useCountdown(endTimestamp);
  const secondsLeft = Math.ceil(msRemaining / 1000);
  const dropdownOptions = useMemo(
    () => buildDropdownOptions(assignedLibrary, template),
    [assignedLibrary, template]
  );

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-gray-400">Fill out your ad-libs sheet</p>
        <p className={cn("text-4xl font-display font-bold", secondsLeft <= 10 ? "text-red-400" : "text-brodin-accent")}>
          {secondsLeft}s
        </p>
      </div>

      <div className="bg-brodin-panel border border-brodin-primary/30 rounded-xl p-4 space-y-3">
        <h3 className="font-display text-lg font-bold text-brodin-gold">{template.title}</h3>
        <div className="space-y-3">
          {template.blanks.map((blank) => (
            <div key={blank.id} className="flex items-center gap-2 flex-wrap">
              <label className="text-xs uppercase tracking-wide text-gray-400 w-20">{blank.category}</label>
              <select
                value={answers[blank.id] ?? ''}
                onChange={(e) => onAnswerChange(blank.id, e.target.value)}
                className="flex-1 min-w-[140px] rounded-lg border border-brodin-primary/40 bg-gray-900 px-3 py-2 text-white focus:outline-none focus:border-brodin-accent"
              >
                <option value="" disabled>Choose a {blank.category}...</option>
                {dropdownOptions[blank.id]?.map((word) => (
                  <option key={word} value={word}>{word}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
