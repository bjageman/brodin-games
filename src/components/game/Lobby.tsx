import { useState } from 'react';
import type { PlayerInfo } from '../../types';
import RoomCodeModal from '../shared/RoomCodeModal';

interface LobbyProps {
  code: string;
  roster: PlayerInfo[];
  isHost: boolean;
  onStartGame?: () => void;
}

export default function Lobby({ code, roster, isHost, onStartGame }: LobbyProps) {
  const [showModal, setShowModal] = useState(false);
  const joinUrl = `${window.location.origin}${window.location.pathname}#/join?code=${code}`;

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <div className="text-center space-y-1">
        <p className="text-xs uppercase tracking-widest text-gray-400">Room Code</p>
        <button
          onClick={() => setShowModal(true)}
          className="text-3xl font-mono font-bold tracking-widest text-brodin-accent hover:opacity-80"
        >
          {code}
        </button>
      </div>

      <div className="bg-brodin-panel border border-brodin-primary/30 rounded-xl p-4 space-y-2">
        <h3 className="text-xs uppercase tracking-wide text-gray-400 font-bold">
          Players ({roster.length})
        </h3>
        <div className="space-y-1.5">
          {roster.length === 0 && <p className="text-sm text-gray-500">Waiting for players to join...</p>}
          {roster.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-sm font-semibold text-gray-100">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {p.name}
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <button
          onClick={onStartGame}
          disabled={roster.length === 0}
          className="w-full bg-brodin-primary hover:bg-brodin-primaryDark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-3 font-bold transition-colors"
        >
          Start Game
        </button>
      )}
      {!isHost && (
        <p className="text-center text-sm text-gray-500">Waiting for the host to start the game...</p>
      )}

      {showModal && <RoomCodeModal gameCode={code} joinUrl={joinUrl} onClose={() => setShowModal(false)} />}
    </div>
  );
}
