// Namespaced VITE_MEMORANDOM_* so a future second game can override its own
// durations/caps without colliding with this one's — see .env.example.
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

// Bonus (on top of 1 point per vote) for winning a matchup outright; ties get none.
export const MATCH_WIN_BONUS = 3;

// Per-category cap on words collected in round 1.
export const MAX_WORDS_PER_CATEGORY = 5;

export const SUBMIT_RETRY_INTERVAL_MS = 1200;
export const SUBMIT_MAX_ATTEMPTS = 8;

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = envPositiveInt('VITE_MEMORANDOM_MAX_PLAYERS', 12);
