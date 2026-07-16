// Shared sessionStorage keys so GameSession can clear the outer route state
// (which page it should resume into) when the player deliberately leaves,
// regardless of whether it was rendered from HostPage or JoinPage.
export const HOST_ROUTE_KEY = 'brodin-host-route';
export const JOIN_ROUTE_KEY = 'brodin-join-route';
export function gameSnapshotKey(code: string): string {
  return `brodin-game-${code}`;
}

/**
 * Thin, generic wrapper around sessionStorage for persisting JSON-shaped
 * state across a page refresh within the same tab. Deliberately dumb (just
 * serialize/deserialize) — callers own the shape of what they store.
 */
export function saveSnapshot<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full/unavailable (private browsing, etc.) — refresh
    // resilience is a nice-to-have, not worth crashing the game over.
  }
}

export function loadSnapshot<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearSnapshot(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing more to do.
  }
}

// Wipe every sessionStorage entry tied to a game session when a player
// deliberately leaves, so nothing lingers to slow a later session or resume
// stale state. This sweeps ALL keys scoped to the room code — not just
// gameSnapshotKey — because some games (Fake It, Joke Factory) persist under
// their own `*-snap-<code>` keys. The room code is uppercase and the retained
// player id is lowercase, so this never touches player identity.
export function clearGameSession(code: string): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && code && key.includes(code)) doomed.push(key);
    }
    doomed.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Storage unavailable (private browsing, etc.) — nothing to clear.
  }
  clearSnapshot(HOST_ROUTE_KEY);
  clearSnapshot(JOIN_ROUTE_KEY);
}
