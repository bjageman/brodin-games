import { cn } from '../../../shared/utils/cn';
import WaitingForHost from '../../../shared/components/WaitingForHost';
import type { GamePlayProps } from '../../../shared/GameShell';
import type { Card, LastReveal, Role, Winner } from '../types';
import { CARD_META } from '../cards';
import { ROUNDS, WIRE_WIN_THRESHOLD } from '../constants';
import { CardArt, LightningBolt } from './BombArt';
import { BoardFrame, BombCard, HandRow, TeamCounts, WiresPanel } from './BombBoard';

function RoleBadge({ role }: { role: Role | undefined }) {
  if (!role) return null;
  const rebel = role === 'rebel';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-[10px] font-black uppercase tracking-widest sm:text-xs',
        rebel
          ? 'border-bomb-rebel bg-bomb-rebel/15 text-bomb-rebel'
          : 'border-bomb-wire bg-bomb-wire/20 text-white'
      )}
    >
      {rebel ? '🧨 Rebel' : '🛡️ Peacekeeper'}
    </span>
  );
}

export function RoleReveal({ role, isDisplay, seconds }: { role: Role | undefined; isDisplay: boolean; seconds: number }) {
  if (isDisplay) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 px-4 py-10 text-center">
        <h2 className="font-display text-2xl font-extrabold uppercase tracking-wider text-white">Dealing roles…</h2>
        <p className="text-sm text-gray-300">Players are learning their team. Cards deal in {seconds}s.</p>
      </div>
    );
  }
  const rebel = role === 'rebel';
  return (
    <div className="mx-auto w-full max-w-md space-y-8 px-4 py-8 text-center">
      <h2 className="font-display text-2xl font-extrabold uppercase tracking-wider text-white">Your Team</h2>
      <div
        className={cn(
          'space-y-5 rounded-3xl border p-8 shadow-2xl',
          rebel ? 'border-bomb-rebel bg-bomb-rebel/15' : 'border-bomb-wire bg-bomb-wire/20'
        )}
      >
        <span className="text-5xl">{rebel ? '🧨' : '🛡️'}</span>
        <h3 className={cn('font-display text-3xl font-black uppercase tracking-widest', rebel ? 'text-bomb-rebel' : 'text-white')}>
          {rebel ? 'Rebel' : 'Peacekeeper'}
        </h3>
        <p className="text-sm leading-relaxed text-gray-200">
          {rebel
            ? 'Sabotage the disarm. You win the moment a bomb is revealed — steer the table toward it.'
            : `Disarm the bomb. Reveal ${WIRE_WIN_THRESHOLD} cut wires before any bomb turns up.`}
        </p>
      </div>
      <div className="space-y-2">
        <div className="animate-bounce font-display text-4xl font-black text-bomb-bolt">{seconds}</div>
        <p className="text-xs uppercase tracking-widest text-gray-300">Dealing cards…</p>
      </div>
    </div>
  );
}

// Each phone only renders its own hand, so a losing flip on someone else's phone
// would otherwise be invisible to everyone but its owner.
export function VerdictOverlay({ reveal, winner }: { reveal: LastReveal | null; winner: Winner }) {
  if (!reveal) return null;
  const meta = CARD_META[reveal.type];
  const rebelsWon = winner === 'rebels';
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-bomb-bg/90 backdrop-blur-sm">
      <div className="flex h-[38%] animate-cardFlip flex-col items-center gap-1 rounded-xl border-2 border-bomb-face/60 bg-bomb-face p-3 shadow-2xl">
        <span className="font-display text-[11px] font-black uppercase tracking-widest text-white">{meta.title}</span>
        <span className="w-14"><CardArt type={reveal.type} /></span>
      </div>
      <div className="animate-verdictIn space-y-1 text-center">
        <p className="text-sm font-bold text-gray-200">
          {reveal.type === 'explode' ? (
            <>💥 Bomb revealed on <span className="text-white">{reveal.targetName}</span></>
          ) : winner === 'peacekeepers' ? (
            <>✂️ Final wire cut on <span className="text-white">{reveal.targetName}</span></>
          ) : (
            <>Out of rounds — the bomb was never disarmed</>
          )}
        </p>
        <p className={cn('font-display text-2xl font-black uppercase tracking-widest', rebelsWon ? 'text-bomb-rebel' : 'text-bomb-bolt')}>
          {rebelsWon ? 'Rebels Win' : 'Peacekeepers Win'}
        </p>
      </div>
    </div>
  );
}

export function MemorizeView({
  role, hand, seconds, isDisplay, isHost, round, wiresRevealed, playerCount, rebelCount, onReady, onQuit,
}: {
  role: Role | undefined; hand: Card[]; seconds: number; isDisplay: boolean; isHost: boolean;
  round: number; wiresRevealed: number; playerCount: number; rebelCount: number | null;
  onReady: () => void; onQuit: () => void;
}) {
  return (
    <BoardFrame onQuit={onQuit}>
      <div className="flex h-full flex-col p-3">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <RoleBadge role={role} />
          <p className="hidden text-center text-[10px] font-bold uppercase tracking-widest text-gray-300 sm:block">
            {round === 1
              ? 'Memorize your hand — it shuffles face-down when the table is dealt'
              : 'Fresh deal — the revealed cards are gone'}
          </p>
          <span className={cn('font-display text-lg font-black', seconds <= 10 ? 'animate-pulse text-bomb-rebel' : 'text-bomb-bolt')}>
            {seconds}s
          </span>
        </div>

        <div className="h-[58%] shrink-0 py-2">
          {isDisplay
            ? <p className="flex h-full items-center justify-center text-sm text-gray-300">Players are memorizing their hands…</p>
            : <HandRow hand={hand} faceUp tappable={false} />}
        </div>

        <div className="flex min-h-0 flex-1 items-end justify-between gap-4">
          <div className="space-y-2">
            <TeamCounts playerCount={playerCount} rebelCount={rebelCount} />
            {isHost && (
              <button
                type="button"
                onClick={onReady}
                className="rounded-full bg-bomb-bolt px-5 py-2 font-display text-xs font-black uppercase tracking-wider text-bomb-ink shadow-lg transition-transform hover:scale-[1.03] sm:text-sm"
              >
                Everyone's Ready — Deal the Table
              </button>
            )}
          </div>
          <div className="-mb-3 -mr-3">
            <WiresPanel wiresRevealed={wiresRevealed} />
          </div>
        </div>
      </div>
    </BoardFrame>
  );
}

export function TableView({
  hand, isMyTurn, activeName, wiresRevealed, lastReveal, isDisplay,
  round, revealsThisRound, revealsPerRound, pendingWinner, playerCount, rebelCount, onTap, onQuit,
}: {
  hand: Card[]; isMyTurn: boolean; activeName: string; wiresRevealed: number; lastReveal: LastReveal | null;
  isDisplay: boolean; round: number; revealsThisRound: number; revealsPerRound: number;
  pendingWinner: Winner | null; playerCount: number; rebelCount: number | null;
  onTap: (i: number) => void; onQuit: () => void;
}) {
  const picksLeft = revealsPerRound - revealsThisRound;
  return (
    <BoardFrame onQuit={onQuit}>
      <div className="flex h-full flex-col p-3">
        <div className="flex shrink-0 items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest sm:text-xs">
          <span className="text-bomb-bolt">
            Round {round}/{ROUNDS} · {picksLeft} {picksLeft === 1 ? 'pick' : 'picks'} left
          </span>
          <span className="truncate text-gray-300">
            {lastReveal
              ? `Last: ${CARD_META[lastReveal.type].title} on ${lastReveal.targetName}`
              : 'Cards are face-down on the table'}
          </span>
        </div>

        <div className="relative h-[58%] shrink-0 py-2">
          {isDisplay ? (
            <p className="flex h-full items-center justify-center text-sm text-gray-300">Watching the table…</p>
          ) : (
            <>
              <HandRow hand={hand} faceUp={false} tappable={!isMyTurn && !pendingWinner} onTap={onTap} />
              {isMyTurn && !pendingWinner && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bomb-bg/50 backdrop-blur-[1px]">
                  <span className="rounded-xl border border-white/15 bg-bomb-board/90 px-4 py-2 text-xs font-bold text-gray-100">
                    🔒 Your own cards are locked
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex min-h-0 flex-1 items-end justify-between gap-4">
          <div className="space-y-1.5">
            <TeamCounts playerCount={playerCount} rebelCount={rebelCount} />
            <p className="text-[11px] font-bold sm:text-sm">
              {isDisplay || !isMyTurn ? (
                <span className="text-gray-200">
                  <span className="text-bomb-bolt">{activeName || '…'}</span> is choosing
                </span>
              ) : (
                <span className="animate-pulse uppercase tracking-wider text-bomb-bolt">
                  Your turn — tap a card on someone else's phone
                </span>
              )}
            </p>
          </div>
          <div className="-mb-3 -mr-3">
            <WiresPanel wiresRevealed={wiresRevealed} />
          </div>
        </div>
      </div>

      {pendingWinner && <VerdictOverlay reveal={lastReveal} winner={pendingWinner} />}
    </BoardFrame>
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
    <div className="mx-auto flex w-full max-w-xl flex-col items-center space-y-6 px-4 py-6">
      <div
        className={cn(
          'w-full space-y-3 rounded-3xl border p-6 text-center shadow-xl',
          rebelsWon ? 'border-bomb-rebel bg-bomb-rebel/15' : 'border-bomb-wire bg-bomb-wire/20'
        )}
      >
        <span className="mx-auto block h-12 w-12">
          <LightningBolt />
        </span>
        <h2 className={cn('font-display text-3xl font-black uppercase tracking-widest', rebelsWon ? 'text-bomb-rebel' : 'text-bomb-bolt')}>
          {rebelsWon ? 'Rebels Win' : 'Peacekeepers Win'}
        </h2>
        <p className="text-sm text-gray-200">
          {rebelsWon
            ? 'The bomb was never disarmed.'
            : `${WIRE_WIN_THRESHOLD} cut wires revealed — the bomb is disarmed!`}
        </p>
      </div>

      <div className="w-full space-y-2 rounded-2xl border border-white/10 bg-bomb-board p-5 shadow-lg">
        <h4 className="border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-wider text-gray-300">Roles Revealed</h4>
        {roster.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-sm">
            <span className="font-bold text-white">{p.name}</span>
            <RoleBadge role={roles[p.id]} />
          </div>
        ))}
      </div>

      {isHost ? (
        <div className="w-full space-y-2">
          <button
            onClick={onPlayAgain}
            className="w-full rounded-lg bg-bomb-bolt py-3 font-display text-sm font-black uppercase tracking-wider text-bomb-ink shadow-lg transition-transform hover:scale-[1.02]"
          >
            Play Again
          </button>
          <button
            onClick={onQuit}
            className="w-full rounded-lg bg-white/10 py-3 text-sm font-semibold uppercase tracking-wider text-gray-200 transition-colors hover:bg-white/20"
          >
            Quit Game
          </button>
        </div>
      ) : (
        <WaitingForHost message="Waiting for the host to restart…" onDisconnect={onQuit} />
      )}
    </div>
  );
}

export { BombCard };
