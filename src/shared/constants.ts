// Anything missing, non-numeric, or <= 0 falls back to the default below.
function envPositiveInt(key: string, fallback: number): number {
  const raw = import.meta.env[key];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const JOIN_RETRY_INTERVAL_MS = 1500;
export const JOIN_MAX_ATTEMPTS = 5;

// Caps how many players can be in the roster at once. Configurable via
// VITE_MAX_PLAYERS since host hardware/screen real estate for a big lobby
// varies; anything missing, non-numeric, or <= 0 falls back to 12.
export const MAX_PLAYERS = envPositiveInt('VITE_MAX_PLAYERS', 12);

// Gates dev-only UI (e.g. a game's "FILL" button) that shouldn't appear
// during real play. Set VITE_DEBUG=true to enable.
export const DEBUG_MODE = import.meta.env.VITE_DEBUG === 'true';
