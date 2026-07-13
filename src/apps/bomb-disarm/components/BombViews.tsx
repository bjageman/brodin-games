import { cn } from '../../../shared/utils/cn';
import WaitingForHost from '../../../shared/components/WaitingForHost';
import type { GamePlayProps } from '../../../shared/GameShell';
import type { Card, CardType, LastReveal, Role, Winner } from '../types';
import { WIRE_WIN_THRESHOLD } from '../constants';

export function CardFace({ card, faceUp, onTap, tappable }: { card: Card; faceUp: boolean; onTap?: () => void; tappable?: boolean }) {
  const shown = faceUp || card.revealed;
  const meta: Record<CardType, { icon: string; label: string; cls: string }> = {
    explode: { icon: '💥', label: 'BOMB', cls: 'from-red-500/30 to-brodin-panel border-red-500 text-red-300' },
    wire: { icon: '✂️', label: 'Cut Wire', cls: 'from-emerald-500/25 to-brodin-panel border-emerald-500 text-emerald-300' },
    blank: { icon: '▢', label: 'Blank', cls: 'from-white/5 to-brodin-panel border-white/10 text-gray-400' },
  };
  const m = meta[card.type];
  return (
    <button
      type="button"
      disabled={!tappable}
      onClick={onTap}
      className={cn(
        'aspect-[3/4] w-full rounded-2xl border-2 flex flex-col items-center justify-center gap-1 font-black transition-all select-none',
        shown
          ? cn('bg-gradient-to-br', m.cls)
          : 'bg-gradient-to-br from-brodin-panel to-brodin-field border-white/10 text-white/70',
        tappable && 'hover:scale-[1.03] active:scale-95 cursor-pointer shadow-lg shadow-black/30 ring-2 ring-brodin-accent/40',
        !tappable && !shown && 'opacity-90'
      )}
    >
      {shown ? (
        <>
          <span className="text-3xl sm:text-4xl">{m.icon}</span>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest">{m.label}</span>
        </>
      ) : (
        <span className="text-3xl sm:text-4xl opacity-40">?</span>
      )}
    </button>
  );
}

export function HandGrid({ hand, faceUp, tappable, onTap }: { hand: Card[]; faceUp: boolean; tappable: boolean; onTap?: (i: number) => void }) {
  return (
    <div className="grid grid-cols-6 grid-rows-1 gap-2 sm:gap-3 w-full max-w-5xl mx-auto">
      {hand.map((card, i) => (
        <CardFace
          key={i}
          card={card}
          faceUp={faceUp}
          tappable={tappable && !card.revealed}
          onTap={onTap ? () => onTap(i) : undefined}
        />
      ))}
    </div>
  );
}

function RoleBadge({ role }: { role: Role | undefined }) {
  if (!role) return null;
  const rebel = role === 'rebel';
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-4 py-1.5 rounded-full border font-black uppercase tracking-widest text-xs',
        rebel ? 'bg-bento-pink/15 border-bento-pink text-bento-pink' : 'bg-brodin-accent/15 border-brodin-accent text-brodin-accent'
      )}
    >
      <span>{rebel ? '🧨' : '🛡️'}</span>
      {rebel ? 'Rebel' : 'Peacekeeper'}
    </div>
  );
}

export function RoleReveal({ role, isDisplay, seconds }: { role: Role | undefined; isDisplay: boolean; seconds: number }) {
  if (isDisplay) {
    return (
      <div className="w-full max-w-md mx-auto py-10 px-4 text-center space-y-4 animate-fadeIn">
        <h2 className="font-display text-2xl font-extrabold text-white uppercase tracking-wider">Dealing roles…</h2>
        <p className="text-sm text-gray-400">Players are learning their team. Cards deal in {seconds}s.</p>
      </div>
    );
  }
  const rebel = role === 'rebel';
  return (
    <div className="w-full max-w-md mx-auto py-8 px-4 text-center space-y-8 animate-fadeIn">
      <h2 className="font-display text-2xl font-extrabold text-white tracking-wider uppercase">Your Team</h2>
      <div
        className={cn(
          'p-8 rounded-3xl border shadow-2xl space-y-5',
          rebel ? 'bg-gradient-to-br from-bento-pink/20 to-brodin-panel border-bento-pink'
                : 'bg-gradient-to-br from-brodin-accent/20 to-brodin-panel border-brodin-accent'
        )}
      >
        <span className="text-5xl">{rebel ? '🧨' : '🛡️'}</span>
        <h3 className={cn('font-display text-3xl font-black uppercase tracking-widest', rebel ? 'text-bento-pink' : 'text-brodin-accent')}>
          {rebel ? 'Rebel' : 'Peacekeeper'}
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed">
          {rebel
            ? 'Sabotage the disarm. You win the moment a bomb is revealed — steer the table toward it.'
            : 'Disarm the bomb. Reveal 6 cut wires before any bomb turns up, and avoid the explode cards.'}
        </p>
      </div>
      <div className="space-y-2">
        <div className="text-4xl font-black text-brodin-gold animate-bounce">{seconds}</div>
        <p className="text-xs uppercase tracking-widest text-gray-400">Dealing cards…</p>
      </div>
    </div>
  );
}

function StatusBar({ wiresRevealed, lastReveal, subtitle }: { wiresRevealed: number; lastReveal: LastReveal | null; subtitle: string }) {
  return (
    <div className="w-full flex items-center justify-between gap-3 px-4 py-2 bg-brodin-panel/70 backdrop-blur rounded-2xl border border-white/5">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: WIRE_WIN_THRESHOLD }).map((_, i) => (
          <span key={i} className={cn('w-3 h-3 rounded-full border', i < wiresRevealed ? 'bg-emerald-400 border-emerald-300' : 'bg-transparent border-white/25')} />
        ))}
        <span className="ml-2 text-xs font-bold text-emerald-300">{wiresRevealed}/{WIRE_WIN_THRESHOLD} wires</span>
      </div>
      <p className="text-xs font-semibold text-gray-300 truncate">
        {lastReveal
          ? lastReveal.type === 'explode'
            ? '💥 Bomb revealed!'
            : `${lastReveal.type === 'wire' ? '✂️ Cut wire' : '▢ Blank'} on ${lastReveal.targetName}`
          : subtitle}
      </p>
    </div>
  );
}

export function MemorizeView({ role, hand, seconds, isDisplay, isHost, onReady, onQuit }: {
  role: Role | undefined; hand: Card[]; seconds: number; isDisplay: boolean;
  isHost: boolean; onReady: () => void; onQuit: () => void;
}) {
  return (
    <div className="flex flex-col h-full w-full p-3 sm:p-5 gap-3">
      <div className="flex items-center justify-between gap-3">
        <RoleBadge role={role} />
        <div className={cn('font-mono font-black text-lg', seconds <= 10 ? 'text-bento-pink animate-pulse' : 'text-brodin-gold')}>{seconds}s</div>
        <button onClick={onQuit} className="text-[11px] text-gray-400 underline">Quit</button>
      </div>
      <p className="text-center text-xs uppercase tracking-widest text-gray-400 font-bold">
        Memorize your hand — it flips face-down and shuffles when the table is dealt
      </p>
      <div className="flex-1 flex items-center justify-center">
        {isDisplay
          ? <p className="text-sm text-gray-400">Players are memorizing their hands…</p>
          : <HandGrid hand={hand} faceUp tappable={false} />}
      </div>
      {/* The timer is now just a ceiling — the host closes the step as soon as
          the table says they're done, rather than everyone waiting it out. */}
      {isHost && (
        <div className="flex justify-center">
          <button
            onClick={onReady}
            className="rounded-full bg-brodin-primary hover:bg-brodin-primaryDark px-6 py-2 font-display text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-brodin-primary/20 transition-colors"
          >
            Everyone's Ready — Deal the Table
          </button>
        </div>
      )}
    </div>
  );
}

export function TableView({
  hand, isMyTurn, activeName, wiresRevealed, lastReveal, isDisplay, onTap, onQuit,
}: {
  hand: Card[]; isMyTurn: boolean; activeName: string; wiresRevealed: number; lastReveal: LastReveal | null;
  isDisplay: boolean; onTap: (i: number) => void; onQuit: () => void;
}) {
  return (
    <div className="flex flex-col h-full w-full p-3 sm:p-5 gap-3">
      <div className="flex items-center gap-3">
        <div className="flex-1"><StatusBar wiresRevealed={wiresRevealed} lastReveal={lastReveal} subtitle="Cards are face-down on the table" /></div>
        <button onClick={onQuit} className="text-[11px] text-gray-400 underline shrink-0">Quit</button>
      </div>

      <div className="text-center">
        {isDisplay ? (
          <p className="text-sm font-bold text-white"><span className="text-brodin-accent">{activeName || '…'}</span> is choosing a card to reveal</p>
        ) : isMyTurn ? (
          <p className="text-sm font-black text-brodin-accent animate-pulse uppercase tracking-wider">Your turn — reach over and tap a card on someone else's phone</p>
        ) : (
          <p className="text-sm font-bold text-white"><span className="text-brodin-accent">{activeName || '…'}</span> is choosing — your cards are tappable</p>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center">
        {isDisplay ? (
          <p className="text-sm text-gray-400">Watching the table…</p>
        ) : (
          <div className="relative w-full">
            <HandGrid hand={hand} faceUp={false} tappable={!isMyTurn} onTap={onTap} />
            {isMyTurn && (
              <div className="absolute inset-0 rounded-2xl bg-gray-950/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                <span className="bg-brodin-panel/90 px-4 py-2 rounded-xl border border-white/10 text-xs text-gray-200 font-bold">🔒 Your own cards are locked</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ResultsView({
  winner, roles, roster, isHost, onPlayAgain, onQuit,
}: {
  winner: Winner | null; roles: Record<string, Role>; roster: GamePlayProps['roster'];
  isHost: boolean; onPlayAgain: () => void; onQuit: () => void;
}) {
  const rebelsWon = winner === 'rebels';
  return (
    <div className="w-full max-w-xl mx-auto px-4 flex flex-col items-center space-y-6 animate-fadeIn py-6">
      <div
        className={cn(
          'w-full rounded-3xl p-6 text-center space-y-3 border shadow-xl',
          rebelsWon ? 'bg-gradient-to-br from-bento-pink/20 to-brodin-panel border-bento-pink'
                    : 'bg-gradient-to-br from-brodin-accent/20 to-brodin-panel border-brodin-accent'
        )}
      >
        <span className="text-5xl">{rebelsWon ? '💥' : '🛡️'}</span>
        <h2 className={cn('font-display text-3xl font-black uppercase tracking-widest', rebelsWon ? 'text-bento-pink' : 'text-brodin-accent')}>
          {rebelsWon ? 'Rebels Win' : 'Peacekeepers Win'}
        </h2>
        <p className="text-sm text-gray-300">
          {rebelsWon ? 'A bomb was revealed — the disarm failed.' : `${WIRE_WIN_THRESHOLD} cut wires revealed — the bomb is disarmed!`}
        </p>
      </div>

      <div className="w-full bg-brodin-panel p-5 rounded-2xl border border-white/5 space-y-2 shadow-lg">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-white/5 pb-2">Roles Revealed</h4>
        {roster.map((p) => {
          const rebel = roles[p.id] === 'rebel';
          return (
            <div key={p.id} className="flex justify-between items-center text-sm">
              <span className="font-bold text-white">{p.name}</span>
              <span className={cn('text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded', rebel ? 'bg-bento-pink/15 text-bento-pink' : 'bg-brodin-accent/15 text-brodin-accent')}>
                {rebel ? '🧨 Rebel' : '🛡️ Peacekeeper'}
              </span>
            </div>
          );
        })}
      </div>

      {isHost ? (
        <div className="w-full space-y-2">
          <button onClick={onPlayAgain} className="w-full bg-brodin-primary hover:bg-brodin-primaryDark text-white rounded-lg py-3 font-bold transition-colors uppercase tracking-wider text-sm shadow-lg shadow-brodin-primary/20">
            Play Again
          </button>
          <button onClick={onQuit} className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-3 font-semibold transition-colors uppercase tracking-wider text-sm">
            Quit Game
          </button>
        </div>
      ) : (
        <WaitingForHost message="Waiting for the host to restart…" onDisconnect={onQuit} />
      )}
    </div>
  );
}
