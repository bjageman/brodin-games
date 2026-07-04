// Round/timer lengths can be shortened via .env for faster manual testing
// (e.g. VITE_ROUND1_DURATION_MS=10000) without touching this file — see
// .env.example. Anything missing, non-numeric, or <= 0 falls back to the
// default below.
function envDurationMs(key: string, fallback: number): number {
  const raw = import.meta.env[key];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const ROUND1_DURATION_MS = envDurationMs('VITE_ROUND1_DURATION_MS', 60_000);
export const ROUND2_DURATION_MS = envDurationMs('VITE_ROUND2_DURATION_MS', 60_000);
export const VOTING_DURATION_MS = envDurationMs('VITE_VOTING_DURATION_MS', 30_000);
export const GRACE_PERIOD_MS = envDurationMs('VITE_GRACE_PERIOD_MS', 15_000);
export const JOIN_RETRY_INTERVAL_MS = 1500;
export const JOIN_MAX_ATTEMPTS = 5;

// Round 1/2 submissions retry the same way join-request does: every client's
// countdown expires at the exact same synced instant, so all their
// submissions burst over ntfy simultaneously — a stress case for best-effort
// delivery. Resending until acked (or giving up after this many tries)
// meaningfully improves delivery odds within the host's grace period.
export const SUBMIT_RETRY_INTERVAL_MS = 1200;
export const SUBMIT_MAX_ATTEMPTS = 8;
