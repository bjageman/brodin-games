import { useEffect, useState, type ReactNode } from 'react';

// Browsers can't truly lock a phone to landscape outside of fullscreen, so we
// fake it: children always get a landscape-shaped box (wider than tall), and
// when the device is physically in portrait we rotate that box 90°. CSS
// transforms preserve hit-testing, so taps still land on the right card.
function useIsPortrait(): boolean {
  const [portrait, setPortrait] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  );
  useEffect(() => {
    const update = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return portrait;
}

/**
 * Full-screen overlay that renders its children as though the device were in
 * landscape, rotating the content when the phone is held in portrait.
 */
export default function LandscapeStage({ children }: { children: ReactNode }) {
  const portrait = useIsPortrait();

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-brodin-bg">
      <div
        className="absolute top-1/2 left-1/2"
        style={
          portrait
            ? { width: '100vh', height: '100vw', transform: 'translate(-50%, -50%) rotate(90deg)' }
            : { width: '100vw', height: '100vh', transform: 'translate(-50%, -50%)' }
        }
      >
        <div className="w-full h-full flex flex-col">{children}</div>
      </div>
    </div>
  );
}
