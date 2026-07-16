import { portraitFor } from '../portraits';

// A player's spot in the party panel: portrait, name, HP bar. HP tracking
// itself is a follow-up (see #79/#80) — this always renders full for now.
export default function PartyCard({ name, index }: { name: string; index: number }) {
  return (
    <div className="overflow-hidden border-2 border-quiz-gold bg-quiz-stone shadow-lg shadow-black/40">
      <img
        src={portraitFor(index)}
        alt=""
        className="aspect-[3/4] w-full object-cover"
      />
      <div className="p-2">
        <p className="truncate font-pixelBlock text-xs uppercase text-quiz-ink">{name}</p>
        <div className="mt-1.5 h-2.5 w-full border border-black bg-quiz-hpTrack">
          <div className="h-full w-full bg-quiz-hp" />
        </div>
      </div>
    </div>
  );
}
