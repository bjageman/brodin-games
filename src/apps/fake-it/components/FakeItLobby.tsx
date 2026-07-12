import { useState } from 'react';
import type { LobbyProps } from '../../../shared/components/Lobby';
import RoomCodeModal from '../../../shared/components/RoomCodeModal';

const EASEL_ART = '/games/fake-it-easel-lobby.png';

// Where the easel's blank canvas sits inside the artwork, as a share of the
// image box. Measured off the art itself so the painted name lands on the
// canvas rather than the frame.
const CANVAS_BOX = {
  left: '3.6%',
  top: '16.7%',
  width: '91.8%',
  height: '52%',
};

function Easel({ name }: { name: string }) {
  // Long names have to shrink or they run off the canvas.
  const size = name.length > 12 ? 'text-lg' : name.length > 8 ? 'text-xl' : 'text-2xl';

  return (
    <div className="relative mx-auto w-full max-w-[160px]">
      <img src={EASEL_ART} alt="" className="w-full" />
      <div
        className="absolute flex items-center justify-center overflow-hidden px-1"
        style={CANVAS_BOX}
      >
        <span
          className={`font-script ${size} font-bold leading-tight text-center text-[#1a1a1a] break-words`}
          title={name}
        >
          {name}
        </span>
      </div>
    </div>
  );
}

export default function FakeItLobby({
  code,
  title,
  minPlayers,
  roster,
  isHost,
  isConnected,
  onStartGame,
}: LobbyProps) {
  const [showModal, setShowModal] = useState(false);
  const joinUrl = `${window.location.origin}${window.location.pathname}#/join?code=${code}`;

  const needed = minPlayers - roster.length;

  return (
    <div className="flex w-full flex-grow flex-col text-fakeit-ink">
      <header className="relative px-4 pb-2 pt-5 sm:pt-8">
        <button
          onClick={() => setShowModal(true)}
          className="mx-auto mb-3 block text-center leading-tight transition-transform hover:scale-105 sm:absolute sm:right-8 sm:top-7 sm:mx-0 sm:mb-0 sm:text-right"
        >
          <span className="block font-serifDisplay text-lg font-bold">Room Code</span>
          <span className="block font-serifDisplay text-2xl tracking-[0.15em]">{code}</span>
        </button>

        <h1 className="text-center font-serifDisplay text-3xl font-bold sm:text-4xl">{title}</h1>
      </header>

      <div className="h-px w-full bg-fakeit-ink/30" />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <h2 className="mb-6 font-serifDisplay text-2xl font-bold">
          Players in Lobby ({roster.length})
        </h2>

        {roster.length === 0 ? (
          <p className="animate-pulse py-16 text-center font-serifDisplay text-lg opacity-75">
            Waiting for players to connect...
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {roster.map((player) => (
              <Easel key={player.id} name={player.name} />
            ))}
          </div>
        )}
      </div>

      <footer className="flex flex-col items-center gap-3 px-4 pb-8 pt-2">
        {isHost ? (
          <>
            <button
              onClick={onStartGame}
              disabled={roster.length < minPlayers || !isConnected}
              className="rounded-full bg-fakeit-ink px-12 py-4 font-display text-xl font-extrabold uppercase tracking-wide text-white shadow-lg transition-transform enabled:hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConnected ? 'Start Game' : 'Reconnecting…'}
            </button>
            {isConnected && needed > 0 && (
              <p className="font-serifDisplay text-base font-bold opacity-90">
                Need {needed} more {needed === 1 ? 'player' : 'players'} to start
              </p>
            )}
          </>
        ) : (
          <p className="font-serifDisplay text-lg font-bold opacity-90">
            Waiting for the host to start the game…
          </p>
        )}
      </footer>

      {showModal && (
        <RoomCodeModal gameCode={code} joinUrl={joinUrl} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
