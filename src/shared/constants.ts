export const JOIN_RETRY_INTERVAL_MS = 1500;
export const JOIN_MAX_ATTEMPTS = 5;

// Gates dev-only UI (e.g. a game's "FILL" button) that shouldn't appear
// during real play. Set VITE_DEBUG=true to enable.
export const DEBUG_MODE = import.meta.env.VITE_DEBUG === 'true';
