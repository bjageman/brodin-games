import { useEffect, useState } from 'react';

/**
 * Countdown driven purely by an absolute epoch-ms deadline (never a locally
 * restarted "N seconds"), so every device hits zero at the same wall-clock
 * moment regardless of clock drift or tab backgrounding. `msRemaining` is
 * derived during render from a ticking `now` rather than set directly in an
 * effect, so the effect only ever subscribes to the interval.
 */
export function useCountdown(endTimestamp: number | null): { msRemaining: number; expired: boolean } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endTimestamp) return;
    const interval = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(interval);
  }, [endTimestamp]);

  if (!endTimestamp) return { msRemaining: 0, expired: false };

  const msRemaining = Math.max(0, endTimestamp - now);
  return { msRemaining, expired: msRemaining <= 0 };
}
