const EMOJI_POOL = [
  '🦁', '🐸', '🦊', '🐼', '🐨', '🦄', '🐙', '🦖', '🐧', '🦉',
  '🐢', '🦋', '🐝', '🦈', '🐳', '🦜', '🐺', '🦔', '🐯', '🐮',
  '🐷', '🐵', '🐰', '🦝', '🦡', '🦦', '🦥', '🦩', '🦚', '🦫',
];

/**
 * Picks a random emoji for a newly-joined player, preferring one nobody
 * else currently in the roster already has (falls back to a full-pool
 * random pick once every emoji is taken).
 */
export function assignPlayerEmoji(existingEmojis: string[]): string {
  const unused = EMOJI_POOL.filter((e) => !existingEmojis.includes(e));
  const pool = unused.length > 0 ? unused : EMOJI_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}
