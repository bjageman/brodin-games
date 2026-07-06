import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useGameSocket } from './hooks/useGameSocket';
import {
  saveSnapshot,
  loadSnapshot,
  clearSnapshot,
  gameSnapshotKey,
  HOST_ROUTE_KEY,
  JOIN_ROUTE_KEY,
} from './utils/sessionSnapshot';
import { JOIN_MAX_ATTEMPTS, JOIN_RETRY_INTERVAL_MS } from './constants';
import type { Envelope, JoinAckPayload, JoinRequestPayload, PlayerInfo, RosterUpdatePayload } from './types';
import Lobby from './components/Lobby';

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
}

interface GameShellProps {
  code: string;
  playerId: string;
  name: string;
  isHost: boolean;
  title: string;
  minPlayers: number;
  maxPlayers: number;
  isDisplay?: boolean;
  onLeaveGame: () => void;
  gamePlay: ComponentType<GamePlayProps>;
  // Called once while still in the lobby, so a game can warm up anything
  // slow-loading (e.g. a dictionary) during idle time before it's needed.
  onIdlePrefetch?: () => void;
}

interface GameShellSnapshot {
  phase: ShellPhase;
  roster: PlayerInfo[];
}

export default function GameShell({ code, playerId, name, isHost, title, minPlayers, maxPlayers, isDisplay = false, onLeaveGame, gamePlay: GamePlay, onIdlePrefetch }: GameShellProps) {
  const restored = loadSnapshot<GameShellSnapshot>(gameSnapshotKey(code));

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
  }, [phase]);

  // Merges into whatever the active game module saved under the same key (see its matching merge-write).
  useEffect(() => {
    const current = loadSnapshot<Record<string, unknown>>(gameSnapshotKey(code)) ?? {};
    saveSnapshot(gameSnapshotKey(code), { ...current, phase, roster });
  }, [code, phase, roster]);

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
      payload: { accepted: true },
    });
    sendMessage({
      type: 'roster-update',
      timestamp: Date.now(),
      payload: { players: nextRoster },
    });
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
    sendMessage({ type: 'game-start', timestamp: Date.now(), payload: {} });
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

  return (
    <div className="w-full flex-1 flex flex-col items-center pt-2">
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
        <Lobby
          code={code}
          title={title}
          minPlayers={minPlayers}
          roster={roster}
          isHost={isHost}
          isDisplay={isDisplay}
          isConnected={isConnected}
          onStartGame={startGame}
          onQuit={goToMainMenu}
        />
      )}

      {phase === 'in-game' && (
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
        />
      )}
    </div>
  );
}
