import { useState, useMemo } from 'react';
import { useCountdown } from '../../hooks/useCountdown';
import { isValidWord } from '../../utils/dictionary';
import { cn } from '../../utils/cn';

interface Round1TypingProps {
  endTimestamp: number;
  words: string[];
  onAddWord: (word: string) => void;
}

export default function Round1Typing({ endTimestamp, words, onAddWord }: Round1TypingProps) {
  const { msRemaining } = useCountdown(endTimestamp);
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const seen = useMemo(() => new Set(words.map((w) => w.toLowerCase())), [words]);

  const secondsLeft = Math.ceil(msRemaining / 1000);

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
    onAddWord(word);
    setInput('');
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-gray-400">Type as many words as you can</p>
        <p className={cn("text-4xl font-display font-bold", secondsLeft <= 10 ? "text-red-400" : "text-brodin-accent")}>
          {secondsLeft}s
        </p>
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
        {words.map((w, i) => (
          <span
            key={`${w}-${i}`}
            className="px-3 py-1.5 rounded-full bg-brodin-primary/20 border border-brodin-primary/40 text-sm font-semibold text-brodin-accent animate-scaleIn"
          >
            {w}
          </span>
        ))}
      </div>

      <p className="text-center text-xs text-gray-500">
        Only nouns, verbs, adjectives, and pronouns make it into round 2. Other words may not survive.
      </p>
    </div>
  );
}
