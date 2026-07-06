import { useState } from 'react';
import { useCountdown } from '../../../shared/hooks/useCountdown';
import { isValidWord } from '../utils/dictionary';
import { tagWord } from '../utils/posTagging';
import { CATEGORY_STYLES } from '../utils/categoryColors';
import { DEBUG_MODE } from '../../../shared/constants';
import { MAX_WORDS_PER_CATEGORY } from '../constants';
import { CATEGORIES } from '../types';
import type { Category, WordLibrary } from '../types';
import { cn } from '../../../shared/utils/cn';
import fallbackWordsData from '../data/fallbackWords.json';

const FALLBACK_WORDS = fallbackWordsData as WordLibrary;

interface Round1TypingProps {
  endTimestamp: number | null;
  library: WordLibrary;
  onAddWord: (category: Category, word: string) => void;
}

export default function Round1Typing({ endTimestamp, library, onAddWord }: Round1TypingProps) {
  const { msRemaining } = useCountdown(endTimestamp);
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);

  const secondsLeft = endTimestamp === null ? 'Paused' : Math.ceil(msRemaining / 1000);
  const seen = new Set(CATEGORIES.flatMap((c) => library[c]).map((w) => w.toLowerCase()));

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  };

  const submitWord = (e: React.FormEvent) => {
    e.preventDefault();
    const word = input.trim();
    if (!word) return;
    const lower = word.toLowerCase();
    if (seen.has(lower)) {
      triggerShake();
      setInput('');
      return;
    }
    if (!isValidWord(word)) {
      triggerShake();
      setInput('');
      return;
    }
    // Pronouns are sourced exclusively from the player picks below, so a
    // typed word that tags as one (or doesn't tag as anything usable) is
    // rejected here rather than silently miscategorized.
    const category = tagWord(word);
    if (!category || category === 'pronoun') {
      triggerShake();
      setInput('');
      return;
    }
    if (library[category].length >= MAX_WORDS_PER_CATEGORY) {
      triggerShake();
      setInput('');
      return;
    }
    onAddWord(category, word);
    setInput('');
  };

  const fillAll = () => {
    for (const category of CATEGORIES.filter((c) => c !== 'pronoun')) {
      const options = FALLBACK_WORDS[category].filter((w) => !seen.has(w.toLowerCase()));
      let needed = MAX_WORDS_PER_CATEGORY - library[category].length;
      for (const word of options) {
        if (needed <= 0) break;
        onAddWord(category, word);
        needed -= 1;
      }
    }
  };

  return (
    <div className="w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto space-y-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-gray-400">Type as many words as you can</p>
        <p className={cn("text-4xl font-display font-bold", typeof secondsLeft === 'number' && secondsLeft <= 10 ? "text-red-400" : "text-brodin-accent")}>
          {typeof secondsLeft === 'number' ? `${secondsLeft}s` : 'Paused'}
        </p>
      </div>

      {DEBUG_MODE && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={fillAll}
            className="px-3 py-1 rounded-md border border-yellow-500/50 bg-yellow-500/10 text-yellow-400 text-xs font-mono font-bold"
          >
            FILL
          </button>
        </div>
      )}

      <div className="flex justify-center gap-3 flex-wrap">
        {CATEGORIES.filter((c) => c !== 'pronoun').map((category) => {
          const style = CATEGORY_STYLES[category];
          const count = library[category].length;
          return (
            <span
              key={category}
              className={cn("text-[11px] font-mono font-bold px-2 py-1 rounded-md border", style.border, style.text, style.bg)}
            >
              {style.label} {count}/{MAX_WORDS_PER_CATEGORY}
            </span>
          );
        })}
      </div>

      <form onSubmit={submitWord} className={cn("flex gap-2", shake && "animate-shake")}>
        <input
          type="text"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a word..."
          className="flex-1 rounded-lg border border-brodin-primary/40 bg-brodin-panel px-4 py-3 text-center font-semibold text-white focus:outline-none focus:border-brodin-accent"
        />
        <button
          type="submit"
          className="px-4 py-3 rounded-lg bg-brodin-primary hover:bg-brodin-primaryDark font-bold text-white"
        >
          Add
        </button>
      </form>

      <div className="flex flex-wrap gap-2 justify-center">
        {CATEGORIES.filter((c) => c !== 'pronoun').flatMap((category) =>
          library[category].map((w, i) => {
            const style = CATEGORY_STYLES[category];
            return (
              <span
                key={`${category}-${w}-${i}`}
                className={cn("px-3 py-1.5 rounded-full border text-sm font-semibold animate-scaleIn", style.border, style.text, style.bg)}
              >
                {w}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}
