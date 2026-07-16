import { cn } from '../../../shared/utils/cn';
import type { CardType } from '../types';

export function LightningBolt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-full w-full', className)} aria-hidden>
      <path
        d="M13.6 1.5 4 13.9h5.6L8.9 22.5 19.4 9.6h-5.9z"
        fill="#fcec79"
        stroke="#e0952c"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Sparks({ x, y }: { x: number; y: number }) {
  const rays = [
    [-5.5, -3.5],
    [-1.5, -6],
    [3, -5],
    [-4, 3.5],
    [2, 4.5],
  ];
  return (
    <g stroke="#fcec79" strokeWidth="1.6" strokeLinecap="round">
      {rays.map(([dx, dy], i) => (
        <line key={i} x1={x} y1={y} x2={x + dx} y2={y + dy} />
      ))}
    </g>
  );
}

export function WireIcon({ cut, className }: { cut: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 34 26" className={cn('h-full w-full', className)} aria-hidden>
      {cut ? (
        <>
          <path
            d="M2 22C6 22 7.5 15 11.5 12"
            fill="none"
            stroke="#1a1f4d"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M22 13C26 10 27.5 4 32 4"
            fill="none"
            stroke="#1a1f4d"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <Sparks x={13.5} y={11} />
          <Sparks x={20.5} y={14} />
        </>
      ) : (
        <path
          d="M2 22C7 22 8 4 17 4C26 4 27 22 32 22"
          fill="none"
          stroke="#1a1f4d"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function BombIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-full w-full" aria-hidden>
      <circle cx="19" cy="27" r="13" fill="#1a1f4d" />
      <rect x="26" y="9" width="6" height="6" rx="1.5" transform="rotate(45 29 12)" fill="#1a1f4d" />
      <path d="M31 9C34 4 38 6 38 2" fill="none" stroke="#1a1f4d" strokeWidth="2" strokeLinecap="round" />
      <Sparks x={38} y={3} />
      <ellipse cx="14" cy="22" rx="3.5" ry="2.2" fill="#ffffff" opacity="0.35" transform="rotate(-25 14 22)" />
    </svg>
  );
}

function LampIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-full w-full" aria-hidden>
      <line x1="22" y1="0" x2="22" y2="10" stroke="#1a1f4d" strokeWidth="2" />
      <path d="M6 26 22 10l16 16z" fill="#1a1f4d" />
      <ellipse cx="22" cy="26" rx="16" ry="3.5" fill="#1a1f4d" />
      <circle cx="22" cy="30" r="3" fill="#fcec79" />
      <path d="M10 41 22 31l12 10z" fill="#fcec79" opacity="0.35" />
    </svg>
  );
}

function ManualIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-full w-full" aria-hidden>
      <path d="M4 8h14a4 4 0 0 1 4 4v26a5 5 0 0 0-4-2H4z" fill="#1a1f4d" />
      <path d="M40 8H26a4 4 0 0 0-4 4v26a5 5 0 0 1 4-2h14z" fill="#1a1f4d" opacity="0.72" />
      <g stroke="#9a95dd" strokeWidth="1.4" strokeLinecap="round">
        <line x1="7" y1="15" x2="16" y2="15" />
        <line x1="7" y1="20" x2="16" y2="20" />
        <line x1="7" y1="25" x2="13" y2="25" />
      </g>
    </svg>
  );
}

function SilenceIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-full w-full" aria-hidden>
      <path d="M22 6a6 6 0 0 1 6 6v9a6 6 0 0 1-12 0v-9a6 6 0 0 1 6-6z" fill="#1a1f4d" />
      <path d="M11 20a11 11 0 0 0 22 0" fill="none" stroke="#1a1f4d" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="22" y1="31" x2="22" y2="38" stroke="#1a1f4d" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="7" y1="6" x2="37" y2="38" stroke="#fcec79" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function AgentIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-full w-full" aria-hidden>
      <circle cx="22" cy="14" r="7" fill="#1a1f4d" />
      <path d="M6 40c0-8.8 7.2-14 16-14s16 5.2 16 14z" fill="#1a1f4d" />
      <rect x="9" y="11" width="26" height="5" rx="2.5" fill="#fcec79" />
      <circle cx="16" cy="13.5" r="3.4" fill="#1a1f4d" />
      <circle cx="28" cy="13.5" r="3.4" fill="#1a1f4d" />
    </svg>
  );
}

function CrossedWiresIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-full w-full" aria-hidden>
      <g fill="none" stroke="#1a1f4d" strokeWidth="2.6" strokeLinecap="round">
        <path d="M4 10C14 10 30 34 40 34" />
        <path d="M4 34C14 34 30 10 40 10" />
      </g>
      <Sparks x={22} y={22} />
    </svg>
  );
}

function RepairKitIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-full w-full" aria-hidden>
      <path d="M16 10V8a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" fill="none" stroke="#1a1f4d" strokeWidth="2.4" />
      <rect x="4" y="12" width="36" height="26" rx="4" fill="#1a1f4d" />
      <rect x="19" y="18" width="6" height="14" rx="1" fill="#fcec79" />
      <rect x="15" y="22" width="14" height="6" rx="1" fill="#fcec79" />
    </svg>
  );
}

function DoubleAgentIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-full w-full" aria-hidden>
      <path d="M4 16c4-5 12-6 18-6s14 1 18 6c-2 8-8 12-18 12S6 24 4 16z" fill="#1a1f4d" />
      <ellipse cx="14" cy="16" rx="5" ry="4" fill="#9a95dd" />
      <ellipse cx="30" cy="16" rx="5" ry="4" fill="#9a95dd" />
      <path d="M40 16c3 1 5 4 4 9" fill="none" stroke="#fcec79" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SmokeBombIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-full w-full" aria-hidden>
      <rect x="14" y="20" width="16" height="18" rx="3" fill="#1a1f4d" />
      <rect x="18" y="14" width="8" height="6" rx="1.5" fill="#1a1f4d" />
      <path d="M22 14c-2-4 2-6 0-10" fill="none" stroke="#9a95dd" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M13 11c-2-3 2-5 0-8" fill="none" stroke="#9a95dd" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <path d="M31 11c2-3-2-5 0-8" fill="none" stroke="#9a95dd" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function CardArt({ type }: { type: CardType }) {
  switch (type) {
    case 'blank': return null;
    case 'wire': return <WireIcon cut />;
    case 'explode': return <BombIcon />;
    case 'silence': return <SilenceIcon />;
    case 'interrogate': return <LampIcon />;
    case 'rogue-agent': return <AgentIcon />;
    case 'user-manual': return <ManualIcon />;
    case 'crossed-wires': return <CrossedWiresIcon />;
    case 'repair-kit': return <RepairKitIcon />;
    case 'double-agent': return <DoubleAgentIcon />;
    case 'smoke-bomb': return <SmokeBombIcon />;
  }
}
