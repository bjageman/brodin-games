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
    // Backgrounded tabs get their setInterval throttled by the browser (Chrome
    // clamps to ~1/sec, and further after minutes hidden), which can delay
    // expiry detection well past the real deadline. Force an immediate
    // recompute on refocus so round-end logic (e.g. autosubmit) still fires
    // promptly for a player who tabbed away during the countdown.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [endTimestamp]);

  if (!endTimestamp) return { msRemaining: 0, expired: false };

  const msRemaining = Math.max(0, endTimestamp - now);
  return { msRemaining, expired: msRemaining <= 0 };
}
