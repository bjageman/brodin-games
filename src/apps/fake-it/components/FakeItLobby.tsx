import { useState, useRef, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
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

function Easel({ name, avatar }: { name: string; avatar?: string }) {
  // Long names have to shrink or they run off the canvas.
  const size =
    name.length > 12
      ? 'text-sm sm:text-lg'
      : name.length > 8
        ? 'text-base sm:text-xl'
        : 'text-lg sm:text-2xl';

  return (
    <div className="flex flex-col items-center">
      <div className="relative mx-auto w-full max-w-[104px] sm:max-w-[160px]">
        <img src={EASEL_ART} alt="" className="w-full pointer-events-none select-none" />
        <div
          className="absolute flex items-center justify-center overflow-hidden px-1"
          style={CANVAS_BOX}
        >
          {avatar ? (
            <img src={avatar} alt={name} className="max-h-full max-w-full object-contain pointer-events-none" />
          ) : (
            <span
              className={`font-script ${size} font-bold leading-tight text-center text-[#1a1a1a] break-words`}
              title={name}
            >
              {name}
            </span>
          )}
        </div>
      </div>
      <span className="mt-1 block max-w-full truncate text-xs font-semibold sm:text-sm text-fakeit-dark">
        {name}
      </span>
    </div>
  );
}

interface DrawingModalProps {
  onSave: (avatarDataUrl: string) => void;
  onClose: () => void;
}

function DrawingModal({ onSave, onClose }: DrawingModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeColor, setActiveColor] = useState('#1a1a1a');

  const colors = [
    { name: 'Dark', value: '#1a1a1a' },
    { name: 'Red', value: '#dc2626' },
    { name: 'Blue', value: '#2563eb' },
    { name: 'Green', value: '#16a34a' },
    { name: 'Purple', value: '#9333ea' },
    { name: 'Orange', value: '#ea580c' },
  ];

  const getCoordinates = (e: ReactMouseEvent<HTMLCanvasElement> | ReactTouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleStart = (e: ReactMouseEvent<HTMLCanvasElement> | ReactTouchEvent<HTMLCanvasElement>) => {
    const coords = getCoordinates(e);
    if (!coords) return;
    setIsDrawing(true);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(coords.x, coords.y);
  };

  const handleMove = (e: ReactMouseEvent<HTMLCanvasElement> | ReactTouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const handleEnd = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-display">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border-4 border-fakeit-ink bg-fakeit-panel p-6 text-fakeit-dark shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <h3 className="font-serifDisplay text-2xl font-bold text-fakeit-ink">
          Draw Your Avatar
        </h3>

        <canvas
          ref={canvasRef}
          width={240}
          height={136}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="bg-white border-2 border-fakeit-ink/30 rounded-2xl cursor-crosshair touch-none select-none shadow-inner"
        />

        {/* Color Palette */}
        <div className="flex gap-2.5">
          {colors.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setActiveColor(c.value)}
              className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                activeColor === c.value ? 'border-fakeit-ink scale-105' : 'border-transparent'
              }`}
              style={{ backgroundColor: c.value }}
              title={c.name}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex w-full gap-2 mt-2">
          <button
            type="button"
            onClick={clearCanvas}
            className="flex-1 rounded-full border-2 border-fakeit-ink/40 py-2 text-sm font-bold hover:bg-black/5"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border-2 border-fakeit-ink/40 py-2 text-sm font-bold hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveCanvas}
            className="flex-1 rounded-full bg-fakeit-ink text-white py-2 text-sm font-extrabold uppercase tracking-wider hover:brightness-110"
          >
            Save
          </button>
        </div>
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
  isDisplay,
  isConnected,
  onStartGame,
  onQuit,
  theme,
  playerId,
  sendMessage,
}: LobbyProps) {
  const [showModal, setShowModal] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const joinUrl = `${window.location.origin}${window.location.pathname}#/join?code=${code}`;

  const needed = minPlayers - roster.length;

  const handleSaveAvatar = (avatarDataUrl: string) => {
    setShowDrawModal(false);
    if (sendMessage) {
      sendMessage({
        type: 'update-avatar',
        playerId,
        timestamp: Date.now(),
        payload: { avatar: avatarDataUrl },
      });
    }
  };

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
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serifDisplay text-2xl font-bold">
            Players in Lobby ({roster.length})
          </h2>
          {!isDisplay && (
            <button
              onClick={() => setShowDrawModal(true)}
              className="rounded-full border-2 border-fakeit-ink bg-fakeit-light text-fakeit-ink px-4 py-1.5 font-display text-sm font-bold transition-transform hover:scale-105 hover:bg-fakeit-ink hover:text-white"
            >
              Draw Custom Avatar
            </button>
          )}
        </div>

        {roster.length === 0 ? (
          <p className="animate-pulse py-16 text-center font-serifDisplay text-lg opacity-75">
            Waiting for players to connect...
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4">
            {roster.map((player) => (
              <Easel key={player.id} name={player.name} avatar={player.avatar} />
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

      {showDrawModal && (
        <DrawingModal
          onSave={handleSaveAvatar}
          onClose={() => setShowDrawModal(false)}
        />
      )}
    </div>
  );
}
