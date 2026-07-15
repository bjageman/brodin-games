import { useEffect, useRef, useState } from 'react';
import { useGameSocket } from './hooks/useGameSocket';
import {
  saveSnapshot,
  loadSnapshot,
  clearSnapshot,
  gameSnapshotKey,
  HOST_ROUTE_KEY,
  JOIN_ROUTE_KEY,
} from './utils/sessionSnapshot';
import { JOIN_MAX_ATTEMPTS, JOIN_RETRY_INTERVAL_MS, GAME_START_RESENDS, GAME_START_RESEND_INTERVAL_MS, DEBUG_MODE } from './constants';
import type { Envelope, JoinAckPayload, JoinRequestPayload, PlayerInfo, RosterUpdatePayload } from './types';
import Lobby from './components/Lobby';
import { GAMES_REGISTRY, DEFAULT_THEME } from './games';
import DebugWidget, { type DebugAction } from './components/DebugWidget';
import PageLayout from './components/PageLayout';
import QuitConfirmModal from './components/QuitConfirmModal';

export type ShellPhase = 'joining' | 'join' | 'lobby' | 'in-game';

// The contract every game module implements to plug into GameShell. Once
// phase becomes 'in-game', the game owns its own phases, message protocol,
// and refresh-resume snapshot — the shell just forwards transport + roster.
export interface GamePlayProps {
  code: string;
  playerId: string;
  name: string;
  isHost: boolean;
  roster: PlayerInfo[];
  isConnected: boolean;
  sendMessage: (payload: unknown) => Promise<void>;
  // True only for a host that chose to just display status, not play.
  isDisplay: boolean;
  // True only for a live 'lobby' -> 'in-game' transition this page load;
  // false when a refresh resumed mid-game. Can't infer this from "do I have
  // a restored snapshot?" since Play Again remounts the game fresh while a
  // stale snapshot from the *previous* finished game may still be present.
  freshStart: boolean;
  onRegisterMessageHandler: (handler: (envelope: Envelope) => void) => void;
  onQuit: () => void;
  onRegisterDebugActions?: (actions: DebugAction[], currentPhaseName: string) => void;
  // Lets a game repaint the page chrome as its phase changes (Fake It's play
  // screens are dark, its vote/results screens are light). Pass Tailwind
  // classes — background and text colour. Games that ignore this keep the
  // default in-game background.
  onGameBgChange?: (bgClassName: string | null) => void;
}

interface GameShellProps {
  code: string;
  playerId: string;
  name: string;
  isHost: boolean;
  isDisplay?: boolean;
  onLeaveGame: () => void;
  initialGameId?: string; // e.g. 'memo-random' or 'fake-it'
}

interface GameShellSnapshot {
  phase: ShellPhase;
  roster: PlayerInfo[];
  gameId: string | null;
}

export default function GameShell({
  code,
  playerId,
  name,
  isHost,
  isDisplay = false,
  onLeaveGame,
  initialGameId,
}: GameShellProps) {
  const restored = loadSnapshot<GameShellSnapshot>(gameSnapshotKey(code));

  // We track the game ID. The host gets it from initialGameId, while the client
  // gets it from the join-ack message or session restore.
  const [gameId, setGameId] = useState<string | null>(
    () => restored?.gameId ?? (isHost ? initialGameId ?? 'memo-random' : null)
  );

  // Resolve config from registry
  const gameConfig = gameId ? GAMES_REGISTRY[gameId] : null;
  const title = gameConfig?.title ?? 'Loading...';
  const minPlayers = gameConfig?.minPlayers ?? 3;
  const maxPlayers = gameConfig?.maxPlayers ?? 12;
  const GamePlay = gameConfig?.gamePlay;
  const LobbyView = gameConfig?.lobby ?? Lobby;
  const theme = gameConfig?.theme ?? DEFAULT_THEME;
  const onIdlePrefetch = gameConfig?.onIdlePrefetch;

  // Host is the roster authority, so it seeds itself directly rather than
  // waiting on its own join-request to echo back over ntfy. A display host
  // isn't a player, so it's never added to the roster at all.
  const [phase, setPhase] = useState<ShellPhase>(restored?.phase ?? (isHost ? 'lobby' : 'joining'));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [roster, setRoster] = useState<PlayerInfo[]>(
    () => restored?.roster ?? (isHost && !isDisplay ? [{ id: playerId, name }] : [])
  );
  // See GamePlayProps.freshStart above.
  const [freshStart, setFreshStart] = useState(false);

  // Active game debug state
  const [activeGameDebugActions, setActiveGameDebugActions] = useState<DebugAction[]>([]);
  const [activeGameDebugPhase, setActiveGameDebugPhase] = useState<string>('');
  // Set by the active game (see GamePlayProps.onGameBgChange). Tagged with the
  // game that set it so one game's palette can't bleed into another's.
  const [gameBg, setGameBg] = useState<{ gameId: string | null; className: string | null }>({
    gameId: null,
    className: null,
  });

  // Quit confirm state
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const rosterRef = useRef(roster);
  useEffect(() => { rosterRef.current = roster; }, [roster]);
  // Guards against an out-of-order roster-update rolling the roster back down.
  const lastRosterUpdateAtRef = useRef(0);
  // Set by the active game module once mounted, so every envelope also
  // reaches it (mirrors useGameSocket's own onMessageRef idiom).
  const gameMessageHandlerRef = useRef<((envelope: Envelope) => void) | null>(null);

  useEffect(() => {
    if (phase === 'lobby') onIdlePrefetch?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, gameId]);

  // Merges into whatever the active game module saved under the same key.
  useEffect(() => {
    const current = loadSnapshot<Record<string, unknown>>(gameSnapshotKey(code)) ?? {};
    saveSnapshot(gameSnapshotKey(code), { ...current, phase, roster, gameId });
  }, [code, phase, roster, gameId]);

  const handleMessage = (data: unknown) => {
    const envelope = data as Envelope;

    if (isHost && envelope.type === 'join-request') {
      const payload = envelope.payload as JoinRequestPayload;
      const fromId = envelope.playerId;
      // Forward ref to hostReceiveJoinRequest (needs sendMessage, declared later) — fine, only called after mount.
      // eslint-disable-next-line react-hooks/immutability
      if (fromId && payload?.name) hostReceiveJoinRequest(fromId, payload.name);
    }

    if (envelope.type === 'join-ack') {
      if (envelope.playerId === playerId && phaseRef.current === 'joining') {
        const payload = envelope.payload as JoinAckPayload;
        if (payload.accepted) {
          if (payload.gameId) {
            setGameId(payload.gameId);
          }
          setPhase('lobby');
        } else {
          setPhase('join');
          setErrorMsg(payload.reason ?? 'Could not join the game.');
        }
      }
    } else if (envelope.type === 'roster-update') {
      // Host already updated its own roster synchronously; only non-host clients apply this (and reject stale ones).
      if (!isHost && envelope.timestamp >= lastRosterUpdateAtRef.current) {
        lastRosterUpdateAtRef.current = envelope.timestamp;
        const payload = envelope.payload as RosterUpdatePayload;
        setRoster(payload.players);
      }
    } else if (envelope.type === 'leave-lobby') {
      if (isHost && phaseRef.current === 'lobby') {
        const fromId = envelope.playerId;
        // Forward ref to hostReceiveLeaveLobby (needs sendMessage, declared later) — fine, only called after mount.
        // eslint-disable-next-line react-hooks/immutability
        if (fromId) hostReceiveLeaveLobby(fromId);
      }
    } else if (envelope.type === 'game-start') {
      if (phaseRef.current === 'lobby') {
        setFreshStart(true);
        setPhase('in-game');
      }
    } else if (envelope.type === 'play-again') {
      // Roster stays untouched — everyone just returns to the same lobby.
      setPhase('lobby');
    }

    gameMessageHandlerRef.current?.(envelope);
  };

  const { sendMessage, isConnected } = useGameSocket(code, handleMessage);

  const addDebugBots = async (count: number) => {
    const BOT_NAMES = ['Bilbo', 'Frodo', 'Gandalf', 'Aragorn', 'Legolas', 'Gimli', 'Boromir', 'Samwise', 'Merry', 'Pippin', 'Galadriel', 'Elrond'];
    const takenNames = new Set(roster.map(p => p.name.replace(/ \(Bot\)$/, '').trim().toLowerCase()));
    const availableNames = BOT_NAMES.filter(name => !takenNames.has(name.toLowerCase()));
    
    for (let i = 0; i < count; i++) {
      const name = (availableNames[i % availableNames.length] || `Bot${i + 1}`) + ' (Bot)';
      const botId = 'p-bot-' + Math.random().toString(36).substring(2, 9);
      await sendMessage({
        type: 'join-request',
        playerId: botId,
        timestamp: Date.now(),
        payload: { name }
      });
    }
  };

  function hostReceiveJoinRequest(fromId: string, fromName: string) {
    // Match by id only — two players can share a name, and matching by name would steal the wrong roster slot.
    const existingMatch = rosterRef.current.find((p) => p.id === fromId);

    // A retry from an already-joined player still gets re-acked, even mid-game.
    if (phaseRef.current !== 'lobby' && phaseRef.current !== 'joining' && !existingMatch) {
      sendMessage({
        type: 'join-ack',
        playerId: fromId,
        timestamp: Date.now(),
        payload: { accepted: false, reason: 'Game already in progress.' },
      });
      return;
    }

    if (!existingMatch && rosterRef.current.length >= maxPlayers) {
      sendMessage({
        type: 'join-ack',
        playerId: fromId,
        timestamp: Date.now(),
        payload: { accepted: false, reason: `Room is full (max ${maxPlayers} players).` },
      });
      return;
    }

    // Reject duplicate names outright rather than merging — names are shown everywhere (voting, scoreboard).
    const nameTaken = !existingMatch && rosterRef.current.some(
      (p) => p.name.trim().toLowerCase() === fromName.trim().toLowerCase()
    );
    if (nameTaken) {
      sendMessage({
        type: 'join-ack',
        playerId: fromId,
        timestamp: Date.now(),
        payload: { accepted: false, reason: 'That name is already taken in this room — pick a different one.' },
      });
      return;
    }

    const nextRoster = existingMatch
      ? rosterRef.current.map((p) =>
          p === existingMatch
            ? { id: fromId, name: fromName }
            : p
        )
      : [...rosterRef.current, { id: fromId, name: fromName }];
    rosterRef.current = nextRoster;
    setRoster(nextRoster);

    sendMessage({
      type: 'join-ack',
      playerId: fromId,
      timestamp: Date.now(),
      payload: { accepted: true, gameId },
    });
    sendMessage({
      type: 'roster-update',
      timestamp: Date.now(),
      payload: { players: nextRoster },
    });
  }

  function hostReceiveLeaveLobby(fromId: string) {
    if (!rosterRef.current.some((p) => p.id === fromId)) return;
    const nextRoster = rosterRef.current.filter((p) => p.id !== fromId);
    rosterRef.current = nextRoster;
    setRoster(nextRoster);
    sendMessage({ type: 'roster-update', timestamp: Date.now(), payload: { players: nextRoster } });
  }

  // Join handshake: retry until the host acks, mirrors botc's join-retry pattern.
  useEffect(() => {
    if (phase !== 'joining') return;
    let attempts = 0;
    const trySend = () => {
      sendMessage({ type: 'join-request', playerId, timestamp: Date.now(), payload: { name } });
      attempts++;
      if (attempts >= JOIN_MAX_ATTEMPTS) {
        clearInterval(interval);
        setPhase('join');
        setErrorMsg('Could not reach the host. Double check the code and that they have the game open.');
      }
    };
    trySend();
    const interval = setInterval(trySend, JOIN_RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase, playerId, name, sendMessage]);

  function startGame() {
    if (phaseRef.current !== 'lobby') return;
    // ntfy is best-effort: a just-connected client can miss a single game-start
    // and get stranded in the lobby. Re-broadcast a few times — every client
    // guards on its own lobby phase, so the repeats are harmless no-ops for
    // anyone who already advanced.
    sendMessage({ type: 'game-start', timestamp: Date.now(), payload: {} });
    let resends = 0;
    const interval = setInterval(() => {
      sendMessage({ type: 'game-start', timestamp: Date.now(), payload: {} });
      if (++resends >= GAME_START_RESENDS) clearInterval(interval);
    }, GAME_START_RESEND_INTERVAL_MS);
    setFreshStart(true);
    setPhase('in-game');
  }

  const goToMainMenu = () => {
    // Clear snapshots so a later Host/Join doesn't resume into a game we explicitly left.
    clearSnapshot(gameSnapshotKey(code));
    clearSnapshot(HOST_ROUTE_KEY);
    clearSnapshot(JOIN_ROUTE_KEY);
    window.location.hash = '#/';
  };

  // A display host isn't on the roster, so it has no seat of its own to subtract.
  const otherPlayerCount = Math.max(0, roster.length - (isHost && isDisplay ? 0 : 1));

  const quit = () => {
    if (!isHost) {
      sendMessage({ type: 'leave-lobby', playerId, timestamp: Date.now(), payload: {} });
    }
    goToMainMenu();
  };

  const requestQuit = () => {
    if (otherPlayerCount === 0) quit();
    else setShowQuitConfirm(true);
  };



  const getLayoutProps = (): {
    title: string | undefined;
    bgClassName: string;
    headerClassName?: string;
    dividerClassName: string;
    ownsHeader?: boolean;
  } => {
    if (phase === 'lobby') {
      return {
        title: undefined, // Lobby has its own custom Room Code header layout
        bgClassName: theme.lobbyBg,
        dividerClassName: 'text-[#2b2f74] bg-current opacity-30 h-0', // Hide page layout divider in lobby
        // A game-supplied lobby draws its own header row (title + room code +
        // Quit), so PageLayout must not stack a second one above it.
        ownsHeader: Boolean(gameConfig?.lobby),
      };
    }
    if (phase === 'joining' || phase === 'join') {
      return {
        title: phase === 'joining' ? 'Connecting...' : 'Join Game',
        bgClassName: 'bg-brodin-bg',
        dividerClassName: 'text-brodin-primary',
      };
    }
    // Only games that paint their own in-game background (Fake It) get the
    // themed header. The others still play on dark navy, where the theme's
    // near-black heading would be invisible — they keep the old brodin chrome
    // until they're redesigned.
    const ownBg = gameBg.gameId === gameId ? gameBg.className : null;

    return {
      title: isHost ? title : 'Playing...',
      bgClassName: ownBg ?? 'bg-brodin-bg',
      headerClassName: ownBg ? theme.heading : undefined,
      dividerClassName: ownBg ? theme.heading : 'text-brodin-primary',
    };
  };

  const layoutProps = getLayoutProps();

  const quitFromShell =
    phase === 'joining' || phase === 'join' || layoutProps.ownsHeader
      ? undefined
      : requestQuit;

  return (
    <PageLayout
      title={layoutProps.title}
      bgClassName={layoutProps.bgClassName}
      headerClassName={layoutProps.headerClassName}
      dividerClassName={layoutProps.dividerClassName}
      onQuit={quitFromShell}
    >
      <div className="w-full flex-grow flex flex-col items-center pt-2">
        {phase === 'joining' && (
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-brodin-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-400">Connecting to room {code}...</p>
          </div>
        )}

        {phase === 'join' && errorMsg && (
          <div className="max-w-md text-center space-y-3">
            <p className="text-red-400 text-sm font-semibold">{errorMsg}</p>
            <button onClick={onLeaveGame} className="text-sm text-gray-400 underline">Try again</button>
          </div>
        )}

        {phase === 'lobby' && (
          <LobbyView
            code={code}
            title={title}
            minPlayers={minPlayers}
            roster={roster}
            isHost={isHost}
            isConnected={isConnected}
            onStartGame={startGame}
            onQuit={requestQuit}
            theme={theme}
            lobbyExtra={gameConfig?.lobbyExtra}
            playerTag={gameConfig?.playerTag}
          />
        )}

        {phase === 'in-game' && GamePlay && (
          <GamePlay
            code={code}
            playerId={playerId}
            name={name}
            isHost={isHost}
            roster={roster}
            isConnected={isConnected}
            sendMessage={sendMessage}
            isDisplay={isDisplay}
            freshStart={freshStart}
            onRegisterMessageHandler={(handler) => { gameMessageHandlerRef.current = handler; }}
            onQuit={goToMainMenu}
            onRegisterDebugActions={(actions, gamePhase) => {
              setActiveGameDebugActions(actions);
              setActiveGameDebugPhase(gamePhase);
            }}
            onGameBgChange={(className) => setGameBg({ gameId, className })}
          />
        )}

        {DEBUG_MODE && (
          <DebugWidget
            code={code}
            phase={phase === 'lobby' ? 'Lobby' : activeGameDebugPhase || 'In-Game'}
            isHost={isHost}
            rosterCount={roster.length}
            isConnected={isConnected}
            actions={
              phase === 'lobby'
                ? [
                    {
                      label: '👥 Add 1 Bot Player',
                      onClick: () => addDebugBots(1),
                      variant: 'primary',
                    },
                    {
                      label: '👥 Add 3 Bot Players',
                      onClick: () => addDebugBots(3),
                      variant: 'success',
                    },
                    {
                      label: '👥 Add 5 Bot Players',
                      onClick: () => addDebugBots(5),
                      variant: 'warning',
                    },
                  ]
                : activeGameDebugActions
            }
          />
        )}
      </div>

      {showQuitConfirm && (
        <QuitConfirmModal
          playerCount={otherPlayerCount}
          onConfirm={() => {
            setShowQuitConfirm(false);
            quit();
          }}
          onCancel={() => setShowQuitConfirm(false)}
        />
      )}
    </PageLayout>
  );
}
