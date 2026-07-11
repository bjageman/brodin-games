export const JOIN_RETRY_INTERVAL_MS = 1500;
export const JOIN_MAX_ATTEMPTS = 5;

// The host re-broadcasts 'game-start' this many extra times (over ntfy's
// best-effort delivery) so a client that missed the first one isn't stranded
// in the lobby. Repeats are no-ops once a client has already advanced.
export const GAME_START_RESENDS = 3;
export const GAME_START_RESEND_INTERVAL_MS = 1200;

// Gates dev-only UI (e.g. a game's "FILL" button) that shouldn't appear
// during real play. Set VITE_DEBUG=true to enable.
export const DEBUG_MODE = import.meta.env.VITE_DEBUG === 'true';
