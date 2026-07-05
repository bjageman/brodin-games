import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useGameSocket } from './hooks/useGameSocket';
import { assignPlayerEmoji } from './utils/playerEmoji';
import {
  saveSnapshot,
  loadSnapshot,
  clearSnapshot,
  gameSnapshotKey,
  HOST_ROUTE_KEY,
  JOIN_ROUTE_KEY,
} from './utils/sessionSnapshot';
import { JOIN_MAX_ATTEMPTS, JOIN_RETRY_INTERVAL_MS, MAX_PLAYERS } from './constants';
import type { Envelope, JoinAckPayload, JoinRequestPayload, PlayerInfo, RosterUpdatePayload } from './types';
import Lobby from './components/Lobby';

export type ShellPhase = 'joining' | 'join' | 'lobby' | 'in-game';

// The contract every game module implements to plug into GameShell. Once the
// shell hands off (phase === 'in-game'), the game owns its own phases,
// message protocol, and refresh-resume snapshot entirely — the shell just
// forwards it the transport and roster.
export interface GamePlayProps {
  code: string;
  playerId: string;
  name: string;
  isHost: boolean;
  roster: PlayerInfo[];
  isConnected: boolean;
  sendMessage: (payload: unknown) => Promise<void>;
  // True only when this game was just started live during this page load
  // (host clicked Start Game, or this client just received that broadcast)
  // — false when a refresh resumed straight into an already-running game.
  // A game module needs this instead of "do I have a restored snapshot?"
  // because after a Play Again it remounts fresh while an old snapshot from
  // the *previous* finished game may still be sitting in sessionStorage.
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

export default function GameShell({ code, playerId, name, isHost, title, minPlayers, onLeaveGame, gamePlay: GamePlay, onIdlePrefetch }: GameShellProps) {
  const restored = loadSnapshot<GameShellSnapshot>(gameSnapshotKey(code));

  // The host doesn't need a network round trip to join its own game — it is
  // the authority on the roster, so it seeds itself in directly rather than
  // depending on ntfy echoing its own join-request back to itself (which is
  // not guaranteed, and would otherwise strand the host on a spinner if that
  // echo is ever dropped).
  const [phase, setPhase] = useState<ShellPhase>(restored?.phase ?? (isHost ? 'lobby' : 'joining'));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [roster, setRoster] = useState<PlayerInfo[]>(
    () => restored?.roster ?? (isHost ? [{ id: playerId, name, emoji: assignPlayerEmoji([]) }] : [])
  );
  // Only ever set true by a live 'lobby' -> 'in-game' transition during this
  // page load — see the GamePlayProps.freshStart doc comment above.
  const [freshStart, setFreshStart] = useState(false);

  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const rosterRef = useRef(roster);
  useEffect(() => { rosterRef.current = roster; }, [roster]);
  // 'roster-update' broadcasts a full replacement snapshot every time
  // someone joins. Each send is an independent fire-and-forget HTTP POST
  // (not a single ordered stream), so under a burst of near-simultaneous
  // joins an older snapshot can arrive after a newer one and roll the
  // roster back down. Tracks the timestamp of the last snapshot actually
  // applied so a late, stale one can be detected and ignored.
  const lastRosterUpdateAtRef = useRef(0);
  // Set by the active game module once mounted, so every envelope this shell
  // sees (including ones it also handles itself, like 'game-start') can be
  // forwarded to the game too. Mirrors the onMessageRef idiom already used
  // inside useGameSocket itself.
  const gameMessageHandlerRef = useRef<((envelope: Envelope) => void) | null>(null);

  useEffect(() => {
    if (phase === 'lobby') onIdlePrefetch?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Persists just this shell's slice, merged into whatever the active game
  // module has already saved under the same key — see MemoRandomGame's
  // matching merge-write for why this doesn't clobber the game's fields.
  useEffect(() => {
    const current = loadSnapshot<Record<string, unknown>>(gameSnapshotKey(code)) ?? {};
    saveSnapshot(gameSnapshotKey(code), { ...current, phase, roster });
  }, [code, phase, roster]);

  const handleMessage = (data: unknown) => {
    const envelope = data as Envelope;

    if (isHost && envelope.type === 'join-request') {
      const payload = envelope.payload as JoinRequestPayload;
      const fromId = envelope.playerId;
      // hostReceiveJoinRequest is declared below (it needs sendMessage,
      // declared after handleMessage) — safe at call time since it's only
      // ever invoked once the WebSocket delivers a message, well after the
      // whole component body (including sendMessage) has finished setting up.
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
      // The host is the roster authority — its own rosterRef is already
      // updated synchronously (no round trip) the moment it processes a
      // join, so it must never let a possibly-stale echo of its own
      // broadcast roll that back. Non-host clients still apply these, but
      // reject any snapshot older than the last one actually applied so an
      // out-of-order late arrival can't undo a newer one either.
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
      // Roster is deliberately left untouched — everyone just goes back to
      // the same lobby, same room code, ready for the host to start a fresh
      // game whenever they hit "Start Game" again.
      setPhase('lobby');
    }

    gameMessageHandlerRef.current?.(envelope);
  };

  const { sendMessage, isConnected } = useGameSocket(code, handleMessage);

  function hostReceiveJoinRequest(fromId: string, fromName: string) {
    // Matching on id ONLY (never name) for "is this an existing player" —
    // two different real people can easily end up with the same or default
    // name, and merging by name would silently steal an earlier joiner's
    // roster slot (their old id vanishes, so their later submissions can't
    // be attributed to anyone and show up as "Unknown").
    const existingMatch = rosterRef.current.find((p) => p.id === fromId);

    // A late-arriving retry from someone who already successfully joined
    // (their own join-ack echo was just slow/lost) is not a new join attempt
    // — re-ack it so they can recover, rather than bouncing them to an error
    // screen just because the game has since started without them noticing.
    if (phaseRef.current !== 'lobby' && phaseRef.current !== 'joining' && !existingMatch) {
      sendMessage({
        type: 'join-ack',
        playerId: fromId,
        timestamp: Date.now(),
        payload: { accepted: false, reason: 'Game already in progress.' },
      });
      return;
    }

    if (!existingMatch && rosterRef.current.length >= MAX_PLAYERS) {
      sendMessage({
        type: 'join-ack',
        playerId: fromId,
        timestamp: Date.now(),
        payload: { accepted: false, reason: `Room is full (max ${MAX_PLAYERS} players).` },
      });
      return;
    }

    // Distinct players must have distinct names — two "Bob"s in the same
    // room would be ambiguous everywhere names are shown (voting, the
    // scoreboard, "X and Y contributed the word list"). This is a rejection,
    // not a merge, so it can't misattribute anyone's submissions the way
    // matching by name used to.
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
            ? { id: fromId, name: fromName, emoji: existingMatch.emoji }
            : p
        )
      : [
          ...rosterRef.current,
          { id: fromId, name: fromName, emoji: assignPlayerEmoji(rosterRef.current.map((p) => p.emoji)) },
        ];
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
    // Leaving for good — clear this game's snapshot plus both possible
    // outer-route snapshots (whichever one actually applies; clearing the
    // other is harmless) so a later visit to Host/Join doesn't resume into
    // a game that was explicitly ended/left.
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
          freshStart={freshStart}
          onRegisterMessageHandler={(handler) => { gameMessageHandlerRef.current = handler; }}
          onQuit={goToMainMenu}
        />
      )}
    </div>
  );
}
