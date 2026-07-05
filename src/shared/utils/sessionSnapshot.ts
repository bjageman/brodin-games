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
