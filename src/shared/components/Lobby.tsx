import { useState } from 'react';
import type { PlayerInfo } from '../types';
import RoomCodeModal from './RoomCodeModal';
import QuitConfirmModal from './QuitConfirmModal';
import PlayerNote from './PlayerNote';

interface LobbyProps {
  code: string;
  title: string;
  minPlayers: number;
  roster: PlayerInfo[];
  isHost: boolean;
  isDisplay?: boolean;
  isConnected: boolean;
  onStartGame?: () => void;
  onQuit?: () => void;
}

const BOARD_BLUE = '#6d97ee';
const INK = '#2b2f74';

export default function Lobby({ code, title, minPlayers, roster, isHost, isDisplay = false, isConnected, onStartGame, onQuit }: LobbyProps) {
  const [showModal, setShowModal] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const joinUrl = `${window.location.origin}${window.location.pathname}#/join?code=${code}`;
  // Every viewer occupies one roster slot to subtract as "self" — except a
  // display host, which is never added to the roster at all.
  const otherPlayerCount = Math.max(0, roster.length - (isHost && isDisplay ? 0 : 1));

  const handleQuitClick = () => {
    if (otherPlayerCount > 0) {
      setShowQuitConfirm(true);
    } else {
      onQuit?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto"
      style={{ backgroundColor: BOARD_BLUE, color: INK }}
    >
      {/* Header: title centered, room code top-right (stacks above on mobile) */}
      <header className="relative px-4 pt-5 pb-2 sm:pt-8">
        <button
          onClick={() => setShowModal(true)}
          className="mx-auto mb-3 block text-center leading-tight text-white transition-transform hover:scale-105 sm:absolute sm:right-8 sm:top-7 sm:mx-0 sm:mb-0 sm:text-right lg:right-16 xl:right-24"
        >
          <span className="block font-display text-sm font-bold uppercase tracking-widest sm:text-base">Room Code</span>
          <span className="block font-display text-2xl font-extrabold tracking-[0.2em] sm:text-3xl">{code}</span>
        </button>
        <h1
          className="text-center font-display text-3xl font-extrabold uppercase tracking-wide text-white sm:text-4xl"
          style={{ textShadow: `0 3px 0 rgba(43,47,116,0.25)` }}
        >
          {title}
        </h1>
      </header>

      {/* Notes board */}
      <div className="flex flex-1 items-center justify-center px-4 py-6">
        {roster.length === 0 ? (
          <p className="text-center font-display text-lg font-bold text-white/90">
            Waiting for players to join…
          </p>
        ) : (
          <div className="flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-10">
            {roster.map((p, i) => (
              <PlayerNote key={p.id} name={p.name} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Footer controls */}
      <footer className="flex flex-col items-center gap-3 px-4 pb-8 pt-2">
        {isHost ? (
          <>
            <button
              onClick={onStartGame}
              disabled={roster.length < minPlayers || !isConnected}
              className="rounded-full px-10 py-3.5 font-display text-lg font-extrabold uppercase tracking-wide text-white shadow-lg transition-transform enabled:hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: INK }}
            >
              {isConnected ? 'Start Game' : 'Reconnecting…'}
            </button>
            {isConnected && roster.length < minPlayers && (
              <p className="font-display text-sm font-bold text-white/90">
                Need {minPlayers - roster.length} more{' '}
                {minPlayers - roster.length === 1 ? 'player' : 'players'} to start
              </p>
            )}
            <button
              onClick={handleQuitClick}
              className="text-sm font-semibold text-white/70 underline underline-offset-2 hover:text-white"
            >
              Quit
            </button>
          </>
        ) : (
          <>
            <p className="font-display text-base font-bold text-white/90">Waiting for the host to start the game…</p>
            <button
              onClick={() => onQuit?.()}
              className="text-sm font-semibold text-white/70 underline underline-offset-2 hover:text-white"
            >
              Leave
            </button>
          </>
        )}
      </footer>

      {showModal && <RoomCodeModal gameCode={code} joinUrl={joinUrl} onClose={() => setShowModal(false)} />}
      {showQuitConfirm && (
        <QuitConfirmModal
          playerCount={otherPlayerCount}
          onConfirm={() => {
            setShowQuitConfirm(false);
            onQuit?.();
          }}
          onCancel={() => setShowQuitConfirm(false)}
        />
      )}
    </div>
  );
}
