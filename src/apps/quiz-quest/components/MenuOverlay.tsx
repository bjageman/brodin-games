interface MenuOverlayProps {
  code: string;
  playerCount: number;
  onQuit: () => void;
  onClose: () => void;
}

// Replaces the mockup's "CAMP" button (a typo) — run info plus a way to leave,
// not a unique gameplay mechanic. See #83.
export default function MenuOverlay({ code, playerCount, onQuit, onClose }: MenuOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border-2 border-quiz-gold bg-quiz-panel p-6 text-quiz-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-center font-display text-lg font-extrabold uppercase tracking-wide text-quiz-gold">
          Menu
        </h3>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-quiz-ink/60">Room Code</dt>
            <dd className="font-bold tracking-widest">{code}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-quiz-ink/60">Party Size</dt>
            <dd className="font-bold">{playerCount}</dd>
          </div>
        </dl>

        <div className="mt-6 space-y-2">
          <button
            onClick={onClose}
            className="w-full rounded-full bg-quiz-gold py-2.5 font-display text-xs font-bold uppercase tracking-wider text-quiz-bg transition-transform hover:scale-[1.02]"
          >
            Back to the Dungeon
          </button>
          <button
            onClick={onQuit}
            className="w-full rounded-full border-2 border-quiz-danger py-2.5 font-display text-xs font-bold uppercase tracking-wider text-quiz-danger transition-colors hover:bg-quiz-danger hover:text-quiz-ink"
          >
            Leave Game
          </button>
        </div>
      </div>
    </div>
  );
}
