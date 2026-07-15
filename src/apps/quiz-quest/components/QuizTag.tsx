import { portraitFor } from '../portraits';

// Lobby player tag: a small hero token, in place of the shared lobby's
// generic sticky notes — matches the dungeon-crawler theme.
export default function QuizTag({ name, index }: { name: string; index: number }) {
  return (
    <div
      className="w-28 overflow-hidden rounded-lg border-2 border-quiz-gold bg-quiz-stone shadow-lg shadow-black/40"
      style={{ transform: `rotate(${(index % 2 === 0 ? -1 : 1) * (2 + (index % 3))}deg)` }}
    >
      <img src={portraitFor(index)} alt="" className="aspect-[3/4] w-full object-cover" />
      <p className="truncate px-1.5 py-1 text-center font-display text-[11px] font-bold uppercase tracking-wide">
        {name}
      </p>
    </div>
  );
}
