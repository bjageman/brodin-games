import { useScrollLock } from '../hooks/useScrollLock';
import { createPortal } from 'react-dom';

interface QuitConfirmModalProps {
  playerCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function QuitConfirmModal({ playerCount, onConfirm, onCancel }: QuitConfirmModalProps) {
  useScrollLock();

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xs rounded-xl shadow-2xl p-5 space-y-4 bg-brodin-panel border border-brodin-primary/30 text-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-1">
          <p className="font-display text-base font-bold text-brodin-gold">Quit the Game?</p>
          <p className="text-sm text-gray-400">
            {playerCount} other {playerCount === 1 ? 'player is' : 'players are'} still connected. Quitting now will end the game for everyone.
          </p>
        </div>
        <div className="space-y-2">
          <button
            onClick={onConfirm}
            className="w-full bg-red-600 hover:bg-red-500 text-white rounded-lg py-2.5 font-bold transition-colors"
          >
            Quit Anyway
          </button>
          <button
            onClick={onCancel}
            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg py-2.5 font-bold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
