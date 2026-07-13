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
  const size =
    name.length > 12
      ? 'text-sm sm:text-lg'
      : name.length > 8
        ? 'text-base sm:text-xl'
        : 'text-lg sm:text-2xl';

  return (
    <div className="relative mx-auto w-full max-w-[104px] sm:max-w-[160px]">
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
  onQuit,
  theme,
}: LobbyProps) {
  const [showModal, setShowModal] = useState(false);
  const joinUrl = `${window.location.origin}${window.location.pathname}#/join?code=${code}`;

  const needed = minPlayers - roster.length;

  return (
    <div className="flex w-full flex-grow flex-col text-fakeit-ink">
      {/* One row — Quit | title | room code — with a single rule beneath it.
          PageLayout skips its own header here (GameConfig.lobby owns it), so
          nothing stacks above and nothing collides with the rule. */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 pb-3 pt-5 sm:px-4">
        <div className="justify-self-start">
          {onQuit && (
            <button
              onClick={onQuit}
              className="rounded-full border-2 border-fakeit-ink px-3.5 py-1 font-display text-sm font-bold text-fakeit-ink transition-colors hover:bg-fakeit-ink hover:text-white"
            >
              Quit
            </button>
          )}
        </div>

        <h1 className="justify-self-center whitespace-nowrap font-serifDisplay text-2xl font-bold sm:text-4xl">
          {title}
        </h1>

        <button
          onClick={() => setShowModal(true)}
          className="justify-self-end text-right leading-tight transition-transform hover:scale-105"
        >
          <span className="block font-serifDisplay text-xs font-bold sm:text-lg">Room Code</span>
          <span className="block font-serifDisplay text-lg tracking-[0.15em] sm:text-2xl">
            {code}
          </span>
        </button>
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
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4">
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
        <RoomCodeModal
          gameCode={code}
          joinUrl={joinUrl}
          theme={theme}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
