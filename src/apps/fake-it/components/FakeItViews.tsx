import { cn } from '../../../shared/utils/cn';
import type { PlayerInfo } from '../../../shared/types';
import type { FakeItPhase, Line, Point, Topic } from '../types';
import { TURN_DURATION_MS, formatMoney } from '../constants';
import DrawingCanvas from './DrawingCanvas';

interface FakeItScreensProps {
  phase: FakeItPhase;
  isImposter: boolean;
  topic: Topic | null;
  revealSec: number;
  drawingRound: number;
  drawerIndex: number;
  roster: PlayerInfo[];
  playerId: string;
  imposterId: string;
  getPlayerColor: (pId: string) => string;
  turnSec: number;
  turnMs: number;
  voteSec: number;
  lines: Line[];
  isMyTurn: boolean;
  handleDrawEnd: (points: Point[]) => void;
  myVote: string | null;
  handleVoteSubmit: (targetId: string) => void;
  votes: Record<string, string>;
  scores: Record<string, number>;
  roundPoints: Record<string, number>;
  isHost: boolean;
  handleNextRound: () => void;
  endGame: () => void;
  playAgain: () => void;
  onQuit: () => void;
}

/** The imposter is shown the category but never the word itself. */
const HIDDEN_WORD = '?????????????';

function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn('inline-block shrink-0 rounded-full', className ?? 'h-4 w-4')}
      style={{ backgroundColor: color }}
    />
  );
}

/** The tan prompt slab at the top of the painting screens. */
function PromptPanel({ topic, isImposter }: { topic: Topic | null; isImposter: boolean }) {
  return (
    <div className="w-full rounded-b-3xl bg-fakeit-panel px-6 py-4 text-fakeit-dark">
      <p className="font-serifDisplay text-3xl font-bold leading-tight">
        {isImposter ? HIDDEN_WORD : topic?.name}
      </p>
      <p className="font-serifDisplay text-sm">Category: {topic?.category}</p>
    </div>
  );
}

/** "Alice", "Alice & Bob", "Alice, Bob & Cara" — for the tied-winner headline. */
function formatNames(names: string[]): string {
  if (names.length === 0) return '—';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** Paper-canvas wrapper shared by the drawing / vote / results screens. */
function Paper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative aspect-square w-full max-w-[400px] bg-[#f7f7f7] shadow-lg', className)}>
      {children}
    </div>
  );
}

export default function FakeItScreens({
  phase, isImposter, topic, revealSec, drawingRound, drawerIndex,
  roster, playerId, imposterId, getPlayerColor, turnSec, turnMs, voteSec, lines,
  isMyTurn, handleDrawEnd, myVote, handleVoteSubmit, votes, scores, roundPoints,
  isHost, handleNextRound, endGame, playAgain, onQuit,
}: FakeItScreensProps) {
  const drawer = roster[drawerIndex];
  const imposter = roster.find((p) => p.id === imposterId);
  const pot = Object.values(roundPoints).reduce((sum, n) => sum + n, 0);
  const imposterCaught = pot > 0 && (roundPoints[imposterId] ?? 0) === 0;

  return (
    <div className="flex w-full flex-1 flex-col items-center">
      {/* Starting / Spinner */}
      {phase === 'starting' && (
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-fakeit-panel border-t-transparent" />
        </div>
      )}

      {/* Role Reveal — stage curtains draw back off the prompt */}
      {phase === 'role-reveal' && (
        <div className="mx-auto w-full max-w-md px-4 py-8 text-center">
          <h2 className="mb-6 font-serifDisplay text-2xl font-bold text-fakeit-panel">
            {isImposter ? 'You are the Imposter' : 'Prepare to Paint'}
          </h2>

          <div className="relative overflow-hidden rounded-3xl">
            <div className="bg-fakeit-panel px-6 py-12 text-fakeit-dark">
              <p className="font-serifDisplay text-4xl font-bold leading-tight">
                {isImposter ? HIDDEN_WORD : topic?.name}
              </p>
              <p className="mt-1 font-serifDisplay text-base">
                Category: {topic?.category}
              </p>
              <p className="mt-5 text-sm leading-relaxed text-fakeit-dark/75">
                {isImposter
                  ? 'You only know the category. Watch the others paint, copy their strokes, and blend in.'
                  : 'Paint it stroke by stroke — and find the faker among you.'}
              </p>
            </div>

            {/* The curtains themselves. They cover the panel, hold, then part. */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute inset-y-0 left-0 w-1/2 animate-curtainLeft border-r border-black/20 bg-fakeit-bar" />
              <div className="absolute inset-y-0 right-0 w-1/2 animate-curtainRight border-l border-black/20 bg-fakeit-bar" />
            </div>
          </div>

          <p className="mt-6 font-serifDisplay text-4xl font-bold text-fakeit-panel">{revealSec}</p>
          <p className="text-xs uppercase tracking-widest text-white/60">Starting in…</p>
        </div>
      )}

      {/* Drawing */}
      {phase === 'drawing' && (
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4">
          <PromptPanel topic={topic} isImposter={isImposter} />

          <div className="flex w-full items-center justify-between px-4">
            <p className="text-xs uppercase tracking-wider text-white/60">
              Round {drawingRound} of 2
            </p>
            <span
              className={cn(
                'font-mono text-lg font-black',
                turnSec < 8 ? 'animate-pulse text-red-400' : 'text-fakeit-panel'
              )}
            >
              {turnSec}s
            </span>
          </div>

          <div className="h-1.5 w-[calc(100%-2rem)] overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                'h-full transition-all duration-300',
                turnSec < 8 ? 'bg-red-400' : 'bg-fakeit-panel'
              )}
              style={{ width: `${Math.min(100, (turnMs / TURN_DURATION_MS) * 100)}%` }}
            />
          </div>

          <Paper>
            <DrawingCanvas
              lines={lines}
              activeColor={getPlayerColor(playerId)}
              canDraw={isMyTurn}
              onDrawEnd={handleDrawEnd}
              className="h-full w-full"
            />
            {!isMyTurn && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/5">
                <p className="rounded-lg bg-fakeit-dark/80 px-3 py-1.5 text-xs font-semibold text-white">
                  {drawer?.name} is painting…
                </p>
              </div>
            )}
          </Paper>

          <div className="w-full px-4 pb-6">
            <p className="text-center font-serifDisplay text-2xl font-bold text-fakeit-panel">
              Currently Painting
            </p>

            <div className="mt-2 flex items-center justify-center gap-3">
              <span className="font-display text-2xl font-bold tracking-[0.2em] text-white">
                {isMyTurn ? 'YOU' : drawer?.name?.toUpperCase()}
              </span>
              <Dot color={getPlayerColor(drawer?.id ?? '')} className="h-6 w-6" />
            </div>

            {/* Turn order. Scrolls rather than running off the screen — with a
                full lobby this list is taller than the viewport. */}
            <ul className="mx-auto mt-4 max-h-40 max-w-xs space-y-1.5 overflow-y-auto">
              {roster.map((p, idx) => (
                <li
                  key={p.id}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded px-2 py-1',
                    idx === drawerIndex ? 'bg-white/10' : 'opacity-70'
                  )}
                >
                  <span className="truncate font-serifDisplay text-lg text-white">{p.name}</span>
                  <Dot color={getPlayerColor(p.id)} className="h-5 w-5" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Voting */}
      {phase === 'voting' && (
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 px-4 pb-8">
          <Paper className="mt-2">
            <DrawingCanvas lines={lines} canDraw={false} onDrawEnd={() => {}} className="h-full w-full" />
          </Paper>

          <div className="w-full">
            <div className="flex items-baseline justify-between">
              <h3 className="font-serifDisplay text-3xl font-bold text-fakeit-ink">
                Who is the Imposter?
              </h3>
              <span className="font-mono text-sm font-bold text-fakeit-ink">{voteSec}s</span>
            </div>
            <div className="mt-2 h-px w-full bg-fakeit-ink/30" />
          </div>

          {myVote ? (
            <p className="rounded-lg bg-fakeit-panel px-4 py-3 text-center text-sm text-fakeit-dark">
              Vote locked in for{' '}
              <span className="font-bold">{roster.find((p) => p.id === myVote)?.name}</span>. Waiting
              for the others…
            </p>
          ) : (
            <div className="grid w-full grid-cols-2 gap-4">
              {roster
                .filter((p) => p.id !== playerId)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleVoteSubmit(p.id)}
                    className="flex items-center justify-center gap-2 bg-fakeit-button px-3 py-4 text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {/* The colour dot is the whole point — it's how you tell who
                        painted which strokes on the canvas above. */}
                    <Dot color={getPlayerColor(p.id)} className="h-4 w-4 ring-1 ring-white/50" />
                    <span className="truncate text-sm font-semibold tracking-[0.15em]">
                      {p.name.toUpperCase()}
                    </span>
                  </button>
                ))}
            </div>
          )}

          <div className="flex w-full flex-wrap justify-center gap-2">
            {roster.map((p) => (
              <span
                key={p.id}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-bold',
                  votes[p.id] !== undefined
                    ? 'bg-fakeit-ink text-white'
                    : 'bg-fakeit-ink/10 text-fakeit-ink/60'
                )}
              >
                {p.name} {votes[p.id] !== undefined ? '✓' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Round Totals */}
      {phase === 'results' && (
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 pb-8">
          <Paper className="mt-2">
            <DrawingCanvas lines={lines} canDraw={false} onDrawEnd={() => {}} className="h-full w-full" />
          </Paper>

          <div className="flex w-full items-baseline justify-between">
            <span className="font-serifDisplay text-3xl font-bold text-fakeit-panel">
              {topic?.name}
            </span>
            <span className="font-serifDisplay text-3xl font-bold text-fakeit-panel">
              {formatMoney(pot)}
            </span>
          </div>

          {/* Not in the mockup, but the round is meaningless without knowing
              whether the imposter got away. */}
          <p className="w-full text-sm text-white/80">
            The imposter was{' '}
            <span className="font-bold text-white">{imposter?.name ?? 'unknown'}</span>
            {' — '}
            <span className={imposterCaught ? 'font-bold text-emerald-400' : 'font-bold text-red-400'}>
              {imposterCaught ? 'caught!' : 'they got away!'}
            </span>
          </p>

          <div className="w-full rounded-3xl border-2 border-blue-500 bg-fakeit-panel p-5 text-fakeit-dark">
            <h4 className="text-center font-serifDisplay text-2xl font-bold underline">Payout</h4>
            <p className="mb-4 text-center text-sm font-semibold">
              {imposterCaught ? '(for guessing the imposter)' : '(the imposter escaped)'}
            </p>

            <ul className="space-y-1.5">
              {roster
                .filter((p) => (roundPoints[p.id] ?? 0) > 0)
                .map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 truncate">
                      <Dot color={getPlayerColor(p.id)} className="h-3.5 w-3.5" />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="font-display font-bold text-fakeit-money">
                      {formatMoney(roundPoints[p.id] ?? 0)}
                    </span>
                  </li>
                ))}
              {pot === 0 && (
                <li className="text-center text-sm italic">Nobody was paid this round.</li>
              )}
            </ul>
          </div>

          {isHost ? (
            <div className="flex w-full flex-col items-center gap-2">
              <button
                onClick={handleNextRound}
                className="rounded-full bg-fakeit-button px-10 py-3.5 font-display text-lg font-bold text-white transition-transform hover:scale-[1.03]"
              >
                Next Round
              </button>
              <button
                onClick={endGame}
                className="text-sm text-white/70 underline"
              >
                End game & show final scores
              </button>
            </div>
          ) : (
            <p className="animate-pulse text-sm text-white/60">Waiting for the host…</p>
          )}
        </div>
      )}

      {/* Final Score */}
      {phase === 'leaderboard' && (
        <FinalScore
          roster={roster}
          scores={scores}
          getPlayerColor={getPlayerColor}
          isHost={isHost}
          playAgain={playAgain}
          onQuit={onQuit}
        />
      )}
    </div>
  );
}

function FinalScore({
  roster, scores, getPlayerColor, isHost, playAgain, onQuit,
}: {
  roster: PlayerInfo[];
  scores: Record<string, number>;
  getPlayerColor: (pId: string) => string;
  isHost: boolean;
  playAgain: () => void;
  onQuit: () => void;
}) {
  const ranked = roster
    .map((p) => ({ ...p, score: scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  // A tie at the top means everyone on it won — taking ranked[0] alone would
  // crown whoever the sort happened to put first and bury their equals below.
  const topScore = ranked[0]?.score ?? 0;
  const winners = ranked.filter((p) => p.score === topScore);
  const rest = ranked.filter((p) => p.score !== topScore);
  const shared = winners.length > 1;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 px-4 pb-10 text-fakeit-ink">
      {/* Players are dropped here from the round payout, so say plainly that
          that's it — otherwise it just looks like another scoreboard. */}
      <div className="w-full border-b-2 border-fakeit-ink/20 pb-3 text-center">
        <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-fakeit-ink/60">
          Game Over
        </p>
        <h1 className="font-serifDisplay text-4xl font-bold">Final Scores</h1>
      </div>

      <div className="flex w-full items-baseline justify-between gap-3">
        <h2 className="font-serifDisplay text-2xl font-bold uppercase tracking-wide">
          {shared ? 'Winners' : 'Winner'}: {formatNames(winners.map((w) => w.name))}
        </h2>
        <span className="shrink-0 font-display text-3xl font-extrabold text-fakeit-money">
          {formatMoney(topScore)}
        </span>
      </div>

      {/* Tied winners each get their own easel, side by side. */}
      <div className="flex w-full flex-wrap items-start justify-center gap-3">
        {winners.map((w) => (
          <div
            key={w.id}
            className={cn('relative w-full', shared ? 'max-w-[150px]' : 'max-w-[220px]')}
          >
            <img src="/games/fake-it-easel-lobby.png" alt="" className="w-full" />
            <div
              className="absolute flex items-center justify-center overflow-hidden px-1"
              style={{ left: '3.6%', top: '16.7%', width: '91.8%', height: '52%' }}
            >
              <span
                className={cn(
                  'text-center font-script font-bold leading-tight text-[#1a1a1a]',
                  shared ? 'text-xl' : 'text-3xl'
                )}
              >
                {w.name}
              </span>
            </div>
          </div>
        ))}
      </div>

      <ul className="w-full space-y-2">
        {rest.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 truncate">
              <Dot color={getPlayerColor(p.id)} className="h-3.5 w-3.5" />
              <span className="truncate font-serifDisplay text-xl uppercase">{p.name}</span>
            </span>
            <span className="font-display text-2xl font-extrabold text-fakeit-money">
              {formatMoney(p.score)}
            </span>
          </li>
        ))}
      </ul>

      {isHost ? (
        <div className="flex w-full flex-col items-center gap-3">
          <button
            onClick={playAgain}
            className="w-full max-w-[280px] rounded-full bg-fakeit-button py-3.5 font-display text-lg font-bold text-white transition-transform hover:scale-[1.03]"
          >
            PLAY AGAIN
          </button>
          <button
            onClick={onQuit}
            className="w-full max-w-[280px] rounded-full bg-fakeit-panel py-3.5 font-display text-lg font-bold text-white transition-transform hover:scale-[1.03]"
          >
            QUIT
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="animate-pulse text-sm opacity-70">Waiting for the host to restart…</p>
          <button onClick={onQuit} className="text-sm underline opacity-70">
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
