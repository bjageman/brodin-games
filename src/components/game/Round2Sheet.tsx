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
  onSubmit: () => void;
}

type TextSegment =
  | { kind: 'text'; value: string }
  | { kind: 'blank'; id: string; category: string };

const BLANK_PATTERN = /\{\{(\w+)\}\}/g;

function splitIntoSegments(template: MadLibTemplate): TextSegment[] {
  const categoryById = new Map(template.blanks.map((b) => [b.id, b.category]));
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  for (const match of template.text.matchAll(BLANK_PATTERN)) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: template.text.slice(lastIndex, match.index) });
    }
    const category = categoryById.get(match[1]);
    if (category) segments.push({ kind: 'blank', id: match[1], category });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < template.text.length) {
    segments.push({ kind: 'text', value: template.text.slice(lastIndex) });
  }
  return segments;
}

export default function Round2Sheet({ endTimestamp, template, assignedLibrary, answers, onAnswerChange, onSubmit }: Round2SheetProps) {
  const { msRemaining } = useCountdown(endTimestamp);
  const secondsLeft = Math.ceil(msRemaining / 1000);
  const dropdownOptions = useMemo(
    () => buildDropdownOptions(assignedLibrary, template),
    [assignedLibrary, template]
  );
  const segments = useMemo(() => splitIntoSegments(template), [template]);
  const allAnswered = template.blanks.every((blank) => !!answers[blank.id]);

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
                  answers[seg.id] ? "border-brodin-accent text-brodin-accent" : "border-brodin-primary/40 text-gray-400"
                )}
              >
                <option value="" disabled>{seg.category}...</option>
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
