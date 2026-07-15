import { portraitFor } from '../portraits';

// A player's spot in the party panel: portrait, name, HP bar. HP tracking
// itself is a follow-up (see #79/#80) — this always renders full for now.
export default function PartyCard({ name, index }: { name: string; index: number }) {
  return (
    <div className="overflow-hidden rounded-lg border-2 border-quiz-gold bg-quiz-stone shadow-lg shadow-black/40">
      <img
        src={portraitFor(index)}
        alt=""
        className="aspect-[3/4] w-full object-cover"
      />
      <div className="p-2">
        <p className="truncate font-display text-sm font-bold uppercase tracking-wide">{name}</p>
        <div className="mt-1.5 h-3 w-full rounded-full bg-quiz-hpTrack">
          <div className="h-3 w-full rounded-full bg-quiz-hp" />
        </div>
      </div>
    </div>
  );
}
