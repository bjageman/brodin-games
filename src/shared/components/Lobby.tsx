import { useState, type ComponentType } from 'react';
import type { PlayerInfo } from '../types';
import { DEFAULT_THEME, type GameTheme } from '../games';
import { cn } from '../utils/cn';
import RoomCodeModal from './RoomCodeModal';
import PlayerNote from './PlayerNote';

// Host-only pre-game options a game can hang off the shared lobby (see
// GameConfig.lobbyExtra). Whatever it collects is the host's to keep — the host
// deals, so its choices reach the table inside the game state it broadcasts.
export interface LobbyExtraProps {
  code: string;
  roster: PlayerInfo[];
}

export interface PlayerTagProps {
  name: string;
  index: number;
}

export interface LobbyProps {
  code: string;
  title: string;
  minPlayers: number;
  roster: PlayerInfo[];
  isHost: boolean;
  isDisplay?: boolean;
  isConnected: boolean;
  onStartGame?: () => void;
  // Only used by lobbies that render their own header row (see
  // GameConfig.lobby). The shared lobby leaves Quit to PageLayout.
  onQuit?: () => void;
  theme?: GameTheme;
  lobbyExtra?: ComponentType<LobbyExtraProps>;
  /** Overrides the sticky-note player tag (see GameConfig.playerTag). */
  playerTag?: ComponentType<PlayerTagProps>;
}

export default function Lobby({
  code, title, minPlayers, roster, isHost, isConnected, onStartGame, theme,
  lobbyExtra: LobbyExtra, playerTag: PlayerTag = PlayerNote,
}: LobbyProps) {
  const [showModal, setShowModal] = useState(false);
  const joinUrl = `${window.location.origin}${window.location.pathname}#/join?code=${code}`;
  const t = theme ?? DEFAULT_THEME;

  // Ink used to be a hardcoded navy tuned for the old blue lobby. It now rides
  // on the theme's text colour (set by lobbyBg), so the lobby follows whatever
  // palette the game brings.
  return (
    <div className="w-full flex-grow flex flex-col">
      {/* Header: title centered, room code top-right (stacks above on mobile) */}
      <header className="relative px-4 pt-5 pb-2 sm:pt-8">
        <button
          onClick={() => setShowModal(true)}
          className="mx-auto mb-3 block text-center leading-tight transition-transform hover:scale-105 sm:absolute sm:right-8 sm:top-7 sm:mx-0 sm:mb-0 sm:text-right lg:right-16 xl:right-24"
        >
          <span className="block font-display text-sm font-bold uppercase tracking-widest">Room Code</span>
          <span className="block font-display text-2xl font-extrabold tracking-[0.2em] sm:text-3xl">{code}</span>
        </button>
        <h1 className="text-center font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
          {title}
        </h1>
      </header>

      {/* Main content: players board */}
      <div className="flex-1 px-4 py-6 md:px-8 max-w-4xl w-full mx-auto">
        <div className="min-h-[300px] rounded-2xl border-4 border-black/20 bg-white/40 p-6 shadow-inner flex flex-col">
          <div className="flex items-center justify-between border-b-2 border-black/20 pb-3 mb-6">
            <h2 className="font-display text-lg font-extrabold uppercase tracking-wider">Players in Lobby</h2>
            <span className="font-display text-sm font-extrabold uppercase tracking-wider">
              {roster.length} Joined
            </span>
          </div>

          {roster.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <p className="font-display font-bold text-sm uppercase tracking-wide animate-pulse opacity-75">
                Waiting for players to connect...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {roster.map((player, index) => (
                <PlayerTag key={player.id} name={player.name} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>

      {isHost && LobbyExtra && <LobbyExtra code={code} roster={roster} />}

      {/* Footer controls */}
      <footer className="flex flex-col items-center gap-3 px-4 pb-8 pt-2">
        {isHost ? (
          <>
            <button
              onClick={onStartGame}
              disabled={roster.length < minPlayers || !isConnected}
              className={cn(
                'rounded-full px-10 py-3.5 font-display text-lg font-extrabold uppercase tracking-wide shadow-lg transition-transform enabled:hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50',
                t.accent
              )}
            >
              {isConnected ? 'Start Game' : 'Reconnecting…'}
            </button>
            {isConnected && roster.length < minPlayers && (
              <p className="font-display text-sm font-bold opacity-90">
                Need {minPlayers - roster.length} more{' '}
                {minPlayers - roster.length === 1 ? 'player' : 'players'} to start
              </p>
            )}
          </>
        ) : (
          <p className="font-display text-base font-bold opacity-90">Waiting for the host to start the game…</p>
        )}
      </footer>

      {showModal && (
        <RoomCodeModal gameCode={code} joinUrl={joinUrl} theme={theme} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
