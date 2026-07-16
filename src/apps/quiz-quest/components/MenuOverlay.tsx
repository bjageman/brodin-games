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
        className="w-full max-w-sm border-[3px] border-quiz-gold bg-quiz-panel p-6 font-pixel text-quiz-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-center font-pixelBlock text-lg uppercase text-quiz-gold [text-shadow:2px_2px_0_#000]">
          Menu
        </h3>

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-quiz-ink/60">Room Code</dt>
            <dd className="font-pixelBlock tracking-widest text-quiz-gold">{code}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-quiz-ink/60">Party Size</dt>
            <dd className="font-semibold">{playerCount}</dd>
          </div>
        </dl>

        <div className="mt-6 space-y-2">
          <button
            onClick={onClose}
            className="w-full border-2 border-quiz-gold bg-quiz-gold py-2.5 font-pixelBlock text-xs uppercase text-quiz-bg transition-colors hover:bg-quiz-goldDark hover:text-quiz-ink"
          >
            Back to the Dungeon
          </button>
          <button
            onClick={onQuit}
            className="w-full border-2 border-quiz-danger py-2.5 font-pixelBlock text-xs uppercase text-quiz-danger transition-colors hover:bg-quiz-danger hover:text-quiz-ink"
          >
            Leave Game
          </button>
        </div>
      </div>
    </div>
  );
}
