export interface PlayerInfo {
  id: string;
  name: string;
}

// Not a closed union: shared shell messages (join/roster/game-start/play-again)
// and each app's own private protocol messages all flow through the same
// envelope, so `type` stays a plain string rather than coupling this module
// to every app's message vocabulary. Equality narrowing on a literal still
// works fine for control flow either way.
export type SharedMessageType =
  | 'join-request'
  | 'join-ack'
  | 'roster-update'
  | 'game-start'
  | 'play-again';

export interface Envelope<T = unknown> {
  type: string;
  playerId?: string;
  timestamp: number;
  payload: T;
}

export interface JoinRequestPayload {
  name: string;
}

export interface JoinAckPayload {
  accepted: boolean;
  reason?: string;
}

export interface RosterUpdatePayload {
  players: PlayerInfo[];
}
