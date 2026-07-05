// Round/timer lengths can be shortened via .env for faster manual testing
// (e.g. VITE_MEMORANDOM_ROUND1_DURATION_MS=10000) without touching this file
// — see .env.example. Namespaced per-app (rather than a bare
// VITE_ROUND1_DURATION_MS) so a future second game can define its own round
// durations without colliding with this one. Anything missing, non-numeric,
// or <= 0 falls back to the default below.
function envPositiveInt(key: string, fallback: number): number {
  const raw = import.meta.env[key];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const ROUND1_DURATION_MS = envPositiveInt('VITE_MEMORANDOM_ROUND1_DURATION_MS', 60_000);
export const ROUND2_DURATION_MS = envPositiveInt('VITE_MEMORANDOM_ROUND2_DURATION_MS', 60_000);
export const VOTE_DURATION_MS = envPositiveInt('VITE_MEMORANDOM_VOTE_DURATION_MS', 20_000);
export const RESULTS_DURATION_MS = envPositiveInt('VITE_MEMORANDOM_RESULTS_DURATION_MS', 10_000);
export const GRACE_PERIOD_MS = envPositiveInt('VITE_MEMORANDOM_GRACE_PERIOD_MS', 15_000);

// Bonus points (on top of 1 point per vote received) awarded to the sheet
// that wins a head-to-head matchup outright. Ties award no bonus.
export const MATCH_WIN_BONUS = 3;

// Round 1 word collection caps each of the four categories at this many
// words, so nobody can hoard easy categories (e.g. nouns) at the expense of
// harder ones. Pronouns are capped by this too, naturally bounded further
// by however many players are actually in the roster.
export const MAX_WORDS_PER_CATEGORY = 5;

// Round 1/2 submissions retry the same way join-request does: every client's
// countdown expires at the exact same synced instant, so all their
// submissions burst over ntfy simultaneously — a stress case for best-effort
// delivery. Resending until acked (or giving up after this many tries)
// meaningfully improves delivery odds within the host's grace period.
export const SUBMIT_RETRY_INTERVAL_MS = 1200;
export const SUBMIT_MAX_ATTEMPTS = 8;

// Needs enough players that round 2's "combine two other players' words"
// and the head-to-head voting matchups both have someone to work with.
export const MIN_PLAYERS = 4;

// Caps how many players can be in this game's roster at once. Configurable
// via VITE_MEMORANDOM_MAX_PLAYERS since host hardware/screen real estate for
// a big lobby varies; anything missing, non-numeric, or <= 0 falls back to
// 12. Each game sets its own cap rather than sharing one across all apps.
export const MAX_PLAYERS = envPositiveInt('VITE_MEMORANDOM_MAX_PLAYERS', 12);
