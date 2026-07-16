import { cn } from '../../../shared/utils/cn';
import WaitingForHost from '../../../shared/components/WaitingForHost';
import { useCountdown } from '../../../shared/hooks/useCountdown';
import type { GamePlayProps } from '../../../shared/GameShell';
import type { Card, EffectChoice, GameState, LastReveal, Role, SpecialRole, Winner } from '../types';
import { CARD_META } from '../cards';
import { ROUNDS, wiresToWin } from '../constants';
import { didWin } from '../roles';
import { LightningBolt } from './BombArt';
import { BoardFrame, BombCard, HandRow, TeamCounts, WiresPanel } from './BombBoard';
import { EffectPrompt, EffectWaiting, PeekOverlay } from './BombEffects';
import { DeclarePrompt, RescuePrompt, RescueWaiting, RoleBadge, RoleCard } from './BombRoles';

export function RoleReveal({ role, special, isDisplay, seconds }: {
  role: Role | undefined; special?: SpecialRole; isDisplay: boolean; seconds: number;
}) {
  if (isDisplay) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 px-4 py-10 text-center">
        <h2 className="font-display text-2xl font-extrabold uppercase tracking-wider text-white">Dealing roles…</h2>
        <p className="text-sm text-gray-300">Players are learning their team. Cards deal in {seconds}s.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-md space-y-8 px-4 py-8 text-center">
      <h2 className="font-display text-2xl font-extrabold uppercase tracking-wider text-white">Your Role</h2>
      <RoleCard role={role} special={special} />
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
  const rebelsWon = winner === 'rebels';
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-bomb-bg/90 backdrop-blur-sm">
      <div className="h-[38%]">
        <BombCard card={{ type: reveal.type, revealed: true }} faceUp={false} />
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

// The smoke clears at round's end: an anonymous tally, never who held what.
export function RoundSummaryOverlay({ summary }: { summary: { blanks: number; wires: number } }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-bomb-bg/92 p-4 backdrop-blur-sm">
      <span className="text-4xl">💨</span>
      <h3 className="text-center font-display text-sm font-black uppercase tracking-widest text-bomb-bolt sm:text-base">
        The smoke clears
      </h3>
      <p className="max-w-xs text-center text-sm text-gray-200">
        This round: <span className="font-black text-white">{summary.wires}</span>{' '}
        {summary.wires === 1 ? 'cut wire' : 'cut wires'}, <span className="font-black text-white">{summary.blanks}</span>{' '}
        {summary.blanks === 1 ? 'blank' : 'blanks'} — no telling which was whose.
      </p>
    </div>
  );
}



export function DiscardRecapView({
  isHost, isDisplay, round, discardRecap, onStartNextRound, onQuit,
}: {
  isHost: boolean; isDisplay: boolean; round: number; discardRecap: Card[] | null;
  onStartNextRound: () => void; onQuit: () => void;
}) {
  const showButton = isHost && !isDisplay;
  return (
    <BoardFrame onQuit={onQuit}>
      <div className="flex h-full flex-col p-4 items-center justify-between">
        <div className="text-center space-y-2 mt-4">
          <h2 className="font-display text-lg font-black uppercase tracking-wider text-bomb-bolt sm:text-2xl animate-pulse">
            Round {round - 1} ended
          </h2>
          <p className="text-sm font-semibold text-gray-300">
            Discarded last round:
          </p>
        </div>

        <div className="w-full max-w-2xl min-h-0 flex-1 flex items-center justify-center py-4">
          {discardRecap && discardRecap.length > 0 ? (
            <div className="w-full h-40 sm:h-52">
              <HandRow hand={discardRecap} faceUp tappable={false} />
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No cards were discarded (Smoke round or empty discard).</p>
          )}
        </div>

        <div className="mb-4">
          {showButton ? (
            <button
              type="button"
              onClick={onStartNextRound}
              className="rounded-full bg-bomb-bolt px-6 py-3 font-display text-sm font-black uppercase tracking-wider text-bomb-ink shadow-lg transition-transform hover:scale-[1.03] sm:text-base animate-pulse"
            >
              Start Next Round - Tell players to pick up their phone
            </button>
          ) : (
            <p className="text-center text-sm font-bold uppercase tracking-widest text-bomb-bolt animate-pulse">
              Waiting for host to start the next round...
            </p>
          )}
        </div>
      </div>
    </BoardFrame>
  );
}

export function MemorizeView({
  role, special, hand, isDisplay, isHost, round, wiresRevealed, playerCount, extraRebels, onReady, onQuit,
}: {
  role: Role | undefined; special?: SpecialRole; hand: Card[]; isDisplay: boolean; isHost: boolean;
  round: number; wiresRevealed: number; playerCount: number; extraRebels: number;
  onReady: () => void; onQuit: () => void;
}) {
  return (
    <BoardFrame onQuit={onQuit}>
      <div className="flex h-full flex-col p-3">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <RoleBadge role={role} special={special} />
          {!isDisplay ? (
            <p className="text-center text-[11px] font-black uppercase tracking-wider text-yellow-400 animate-pulse">
              🤫 Hide your screen! Keep your cards secret from others.
            </p>
          ) : (
            <p className="hidden text-center text-[10px] font-bold uppercase tracking-widest text-gray-300 sm:block">
              {round === 1
                ? 'Memorize your hand — it shuffles face-down when the table is dealt'
                : 'Fresh deal — study your new hand'}
            </p>
          )}
        </div>

        <div className="flex h-[70%] shrink-0 flex-col gap-2 py-2 justify-center">
          <div className="min-h-0 flex-1">
            {isDisplay
              ? (
                <p className="flex h-full items-center justify-center text-sm text-gray-300">
                  Players are studying their new hands…
                </p>
              )
              : <HandRow hand={hand} faceUp tappable={false} />}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-end justify-between gap-4">
          <div className="space-y-2">
            <TeamCounts playerCount={playerCount} extraRebels={extraRebels} />
            {isHost && (
              <button
                type="button"
                onClick={onReady}
                className="rounded-full bg-bomb-bolt px-5 py-2 font-display text-xs font-black uppercase tracking-wider text-bomb-ink shadow-lg transition-transform hover:scale-[1.03] sm:text-sm"
              >
                Everyone's Ready
              </button>
            )}
          </div>
          <div className="-mb-3 -mr-3">
            <WiresPanel wiresRevealed={wiresRevealed} target={wiresToWin(playerCount)} />
          </div>
        </div>
      </div>
    </BoardFrame>
  );
}

export function TableView({
  hand, isMyTurn, activeName, wiresRevealed, lastReveal, isDisplay,
  round, revealsThisRound, revealsPerRound, pendingWinner, playerCount, extraRebels,
  state, playerId, roster, onChooseEffect, onChooseRescue, onDeclare, onTap, onQuit,
}: {
  hand: Card[]; isMyTurn: boolean; activeName: string; wiresRevealed: number; lastReveal: LastReveal | null;
  isDisplay: boolean; round: number; revealsThisRound: number; revealsPerRound: number;
  pendingWinner: Winner | null; playerCount: number; extraRebels: number;
  state: GameState; playerId: string; roster: GamePlayProps['roster'];
  onChooseEffect: (choice: EffectChoice) => void;
  onChooseRescue: (save: boolean) => void;
  onDeclare: (team: Role) => void;
  onTap: (i: number) => void; onQuit: () => void;
}) {
  const picksLeft = revealsPerRound - revealsThisRound;
  const {
    pendingEffect, peek, effectNote, rogueAgentId, pendingRescue, specialRoles, opportunistTeam,
    smokeActive, roundSummary,
  } = state;
  const { msRemaining: peekMs } = useCountdown(peek?.endTimestamp ?? null);

  // The Opportunist may flip on their own turn, any time before the game ends.
  const canDeclare =
    !isDisplay && isMyTurn && !pendingWinner && !pendingEffect && !peek && !pendingRescue &&
    specialRoles[playerId] === 'opportunist' && !opportunistTeam;

  // A Smoke Bomb keeps blank/wire reveals anonymous on the shared status line
  // for the rest of the round — your own hand still shows you the truth.
  const obfuscated = smokeActive && lastReveal && (lastReveal.type === 'blank' || lastReveal.type === 'wire');
  const status = effectNote
    ?? (lastReveal
      ? obfuscated
        ? `Last: ??? on ${lastReveal.targetName}`
        : `Last: ${CARD_META[lastReveal.type].title} on ${lastReveal.targetName}`
      : 'Cards are face-down on the table');

  return (
    <BoardFrame onQuit={onQuit}>
      <div className="flex h-full flex-col p-3">
        <div className="flex shrink-0 items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest sm:text-xs">
          <span className="text-bomb-bolt">
            Round {round}/{ROUNDS} · {picksLeft} {picksLeft === 1 ? 'pick' : 'picks'} left
            {rogueAgentId && ' · 🕶️ Rogue Agent'}
          </span>
          <span className="truncate text-gray-300">{status}</span>
        </div>

        <div className="relative h-[70%] shrink-0 py-2">
          {isDisplay ? (
            <p className="flex h-full items-center justify-center text-sm text-gray-300">Watching the table…</p>
          ) : (
            <>
              <HandRow hand={hand} faceUp={false} tappable={!isMyTurn && !pendingWinner} onTap={onTap} smokeActive={smokeActive} />
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
            <TeamCounts playerCount={playerCount} extraRebels={extraRebels} />
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
            {canDeclare && <DeclarePrompt onDeclare={onDeclare} />}
          </div>
          <div className="-mb-3 -mr-3">
            <WiresPanel wiresRevealed={wiresRevealed} target={wiresToWin(playerCount)} />
          </div>
        </div>
      </div>

      {peek && !pendingWinner && (
        <PeekOverlay type={peek.type} ownerName={peek.ownerName} seconds={Math.ceil(peekMs / 1000)} />
      )}

      {pendingRescue && !pendingWinner && !isDisplay && (
        pendingRescue.heroId === playerId
          ? <RescuePrompt bombOwnerName={roster.find((p) => p.id === pendingRescue.bombOwnerId)?.name ?? '?'} onChoose={onChooseRescue} />
          : <RescueWaiting />
      )}

      {pendingEffect && !pendingWinner && !isDisplay && (
        pendingEffect.actorId === playerId
          ? <EffectPrompt effect={pendingEffect} state={state} roster={roster} onChoose={onChooseEffect} />
          : <EffectWaiting effect={pendingEffect} actorName={roster.find((p) => p.id === pendingEffect.actorId)?.name ?? '?'} />
      )}

      {roundSummary && !pendingWinner && <RoundSummaryOverlay summary={roundSummary} />}

      {pendingWinner && <VerdictOverlay reveal={lastReveal} winner={pendingWinner} />}
    </BoardFrame>
  );
}

const END_BLURB: Record<string, string> = {
  bomb: 'A bomb was revealed — the disarm failed.',
  wires: 'Every wire was cut — the bomb is disarmed!',
  timeout: 'The clock ran out. The bomb was never disarmed.',
};

export function ResultsView({
  state, roster, isHost, onPlayAgain, onQuit,
}: {
  state: GameState; roster: GamePlayProps['roster'];
  isHost: boolean; onPlayAgain: () => void; onQuit: () => void;
}) {
  const { winner, roles, specialRoles, endReason } = state;
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
        <p className="text-sm text-gray-200">{endReason ? END_BLURB[endReason] : ''}</p>
      </div>

      <div className="w-full space-y-2 rounded-2xl border border-white/10 bg-bomb-board p-5 shadow-lg">
        <h4 className="border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-wider text-gray-300">Roles Revealed</h4>
        {roster.map((p) => {
          const won = didWin(p.id, state);
          return (
            <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={cn('shrink-0', won ? 'opacity-100' : 'opacity-0')}>🏆</span>
                <span className={cn('truncate font-bold', won ? 'text-bomb-bolt' : 'text-white/60')}>{p.name}</span>
              </span>
              <RoleBadge role={roles[p.id]} special={specialRoles[p.id]} />
            </div>
          );
        })}
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
