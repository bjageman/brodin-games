import { cn } from '../../../shared/utils/cn';
import type { PlayerInfo } from '../../../shared/types';
import type { FakeItPhase, Line, Point, Topic } from '../types';
import { TURN_DURATION_MS } from '../constants';
import DrawingCanvas from './DrawingCanvas';

interface FakeItScreensProps {
  phase: FakeItPhase;
  isImposter: boolean;
  displayTopic: Topic | null;
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
  setPhase: (p: FakeItPhase) => void;
  playAgain: () => void;
  onQuit: () => void;
}

// All of Fake It's per-phase screens. The game component owns the state machine
// and hands the current slice down as props.
export default function FakeItScreens({
  phase, isImposter, displayTopic, topic, revealSec, drawingRound, drawerIndex,
  roster, playerId, imposterId, getPlayerColor, turnSec, turnMs, voteSec, lines,
  isMyTurn, handleDrawEnd, myVote, handleVoteSubmit, votes, scores, roundPoints,
  isHost, handleNextRound, setPhase, playAgain, onQuit,
}: FakeItScreensProps) {
  return (
    <div className="w-full flex-1 flex flex-col items-center">
      {/* Starting / Spinner */}
      {phase === 'starting' && (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-brodin-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Role Reveal Screen */}
      {phase === 'role-reveal' && (
        <div className="w-full max-w-md mx-auto py-8 px-4 text-center space-y-8 animate-fadeIn">
          <h2 className="font-display text-2xl font-extrabold text-white tracking-wider uppercase">
            Prepare to Draw
          </h2>

          <div
            className={cn(
              "p-8 rounded-3xl border shadow-2xl transition-all duration-500 scale-100 transform",
              isImposter
                ? "bg-gradient-to-br from-bento-pink/20 to-brodin-panel border-bento-pink"
                : "bg-gradient-to-br from-brodin-accent/20 to-brodin-panel border-brodin-accent"
            )}
          >
            {isImposter ? (
              <div className="space-y-6">
                <span className="text-4xl">🕵️‍♂️</span>
                <h3 className="font-display text-3xl font-black text-bento-pink uppercase tracking-widest animate-pulse">
                  Imposter
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  You do not know the topic. Watch the other players draw, copy their strokes, and blend in!
                </p>
                <div className="text-5xl font-extrabold text-white tracking-widest bg-brodin-field py-4 rounded-2xl border border-white/5">
                  ???
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <span className="text-4xl">🎨</span>
                <h3 className="font-display text-3xl font-black text-brodin-accent uppercase tracking-widest">
                  Artist
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Your topic is below. Draw it line-by-line and identify the faking imposter!
                </p>
                <div className="bg-brodin-field p-5 rounded-2xl border border-white/5 space-y-2">
                  <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Category: {displayTopic?.category}</p>
                  <p className="text-3xl font-black text-white uppercase tracking-wider">{displayTopic?.name}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-4xl font-black text-brodin-gold animate-bounce">
              {revealSec}
            </div>
            <p className="text-xs uppercase tracking-widest text-gray-400">Game starting in...</p>
          </div>
        </div>
      )}

      {/* Drawing Screen */}
      {phase === 'drawing' && (
        <div className="w-full max-w-xl mx-auto px-4 flex flex-col items-center space-y-4 animate-fadeIn">
          {/* Header info */}
          <div className="w-full flex justify-between items-center bg-brodin-panel/60 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/5">
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                Drawing Round {drawingRound} of 2
              </p>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full animate-pulse"
                  style={{ backgroundColor: getPlayerColor(roster[drawerIndex]?.id) }}
                />
                <p className="text-sm font-bold text-white">
                  {roster[drawerIndex]?.id === playerId ? (
                    <span className="text-brodin-accent font-black">YOUR TURN!</span>
                  ) : (
                    <span>{roster[drawerIndex]?.name} is drawing...</span>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className={cn("text-lg font-black font-mono", turnSec < 8 ? "text-bento-pink animate-pulse" : "text-brodin-gold")}>
                {turnSec}s
              </span>
            </div>
          </div>

          {/* Time progress bar */}
          <div className="w-full h-1.5 bg-brodin-field rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all duration-300", turnSec < 8 ? "bg-bento-pink" : "bg-brodin-accent")}
              style={{ width: `${Math.min(100, (turnMs / TURN_DURATION_MS) * 100)}%` }}
            />
          </div>

          {/* Canvas Wrapper */}
          <div className="relative w-full max-w-[400px] aspect-square">
            <DrawingCanvas
              lines={lines}
              activeColor={getPlayerColor(playerId)}
              canDraw={isMyTurn}
              onDrawEnd={handleDrawEnd}
              className="w-full h-full"
            />
            {/* Overlay if not turn */}
            {!isMyTurn && (
              <div className="absolute inset-0 bg-gray-950/20 backdrop-blur-[1px] pointer-events-none rounded-2xl flex items-center justify-center">
                <div className="bg-brodin-panel/90 px-4 py-2 rounded-xl border border-white/5 shadow-lg max-w-[80%] text-center">
                  <p className="text-xs text-gray-300 font-medium">
                    ✏️ {roster[drawerIndex]?.name} is drawing. Please wait...
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Topic helper for artists */}
          {!isImposter && (
            <div className="text-center bg-brodin-field/60 px-5 py-2.5 rounded-xl border border-white/5">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Your Secret Topic</p>
              <p className="text-base font-extrabold text-white uppercase">{topic?.name}</p>
            </div>
          )}

          {/* Player roster footer */}
          <div className="w-full bg-brodin-panel/30 p-3 rounded-2xl border border-white/5">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-2 text-center">Roster Order</p>
            <div className="flex gap-3 overflow-x-auto justify-center pb-1">
              {roster.map((p, idx) => {
                const active = idx === drawerIndex;
                const hasDrawn = lines.filter((l) => l.playerId === p.id).length >= drawingRound;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex flex-col items-center p-2 rounded-xl min-w-[70px] border transition-all duration-300",
                      active ? "bg-white/10 border-white/30 scale-105" : "border-transparent opacity-70"
                    )}
                  >
                    <div
                      className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black text-white"
                      style={{ borderColor: getPlayerColor(p.id), backgroundColor: getPlayerColor(p.id) + '20' }}
                    >
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-[10px] font-semibold text-gray-300 truncate max-w-[65px] mt-1">{p.name}</span>
                    {hasDrawn && <span className="text-[9px] text-brodin-accent mt-0.5">✓ Drawn</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Voting Screen */}
      {phase === 'voting' && (
        <div className="w-full max-w-xl mx-auto px-4 flex flex-col items-center space-y-4 animate-fadeIn">
          <div className="w-full text-center bg-brodin-panel/60 p-4 rounded-2xl border border-white/5">
            <h3 className="font-display text-lg font-bold text-white uppercase">Who is the Imposter?</h3>
            <p className="text-xs text-gray-400 mt-1">Study the final drawing. Vote for the player who is faking it!</p>
            <div className="text-brodin-gold font-mono font-bold text-sm mt-1">{voteSec}s remaining</div>
          </div>

          {/* Final Masterpiece */}
          <div className="w-full max-w-[400px] aspect-square">
            <DrawingCanvas
              lines={lines}
              canDraw={false}
              onDrawEnd={() => {}}
              className="w-full h-full"
            />
          </div>

          {/* Voting Buttons */}
          <div className="w-full space-y-2">
            {myVote ? (
              <div className="text-center p-4 bg-brodin-field rounded-xl border border-white/5 text-sm text-gray-300">
                Vote submitted for <span className="text-white font-bold">{roster.find((p) => p.id === myVote)?.name}</span>. Waiting for other players...
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 w-full">
                {roster
                  .filter((p) => p.id !== playerId)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleVoteSubmit(p.id)}
                      className="bg-brodin-panel hover:bg-brodin-panel/85 active:scale-[0.98] border border-white/10 rounded-xl p-3.5 flex flex-col items-center gap-1.5 transition-all text-white font-bold"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
                        style={{ backgroundColor: getPlayerColor(p.id) }}
                      >
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm truncate w-full text-center">{p.name}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Who has voted progress checkmarks */}
          <div className="w-full bg-brodin-panel/20 p-3 rounded-xl text-center border border-white/5">
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Vote Submissions</p>
            <div className="flex gap-2 flex-wrap justify-center">
              {roster.map((p) => {
                const voted = votes[p.id] !== undefined;
                return (
                  <span
                    key={p.id}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full font-bold transition-all",
                      voted ? "bg-brodin-accent/20 text-brodin-accent border border-brodin-accent/30" : "bg-brodin-field text-gray-400 border border-white/5"
                    )}
                  >
                    {p.name} {voted ? '✓' : ''}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Results Screen */}
      {phase === 'results' && (
        <div className="w-full max-w-xl mx-auto px-4 flex flex-col items-center space-y-6 animate-fadeIn">
          {/* Large Imposter Reveal Card */}
          <div className="w-full bg-gradient-to-br from-bento-pink/15 to-brodin-panel border border-bento-pink rounded-3xl p-6 text-center space-y-4 shadow-xl">
            <p className="text-[10px] font-bold text-bento-pink uppercase tracking-widest">Imposter Revealed!</p>
            <h3 className="font-display text-3xl font-black text-white uppercase tracking-wider">
              {roster.find((p) => p.id === imposterId)?.name ?? 'Unknown'}
            </h3>
            <p className="text-xs text-gray-300">
              was the Imposter! The secret topic was{' '}
              <span className="text-brodin-accent font-black uppercase">{topic?.name}</span> (Category: {topic?.category}).
            </p>
          </div>

          {/* Masterpiece Showcase */}
          <div className="w-full max-w-[340px] aspect-square">
            <DrawingCanvas
              lines={lines}
              canDraw={false}
              onDrawEnd={() => {}}
              className="w-full h-full"
            />
          </div>

          {/* Vote breakdowns & Point summaries */}
          <div className="w-full bg-brodin-panel p-5 rounded-2xl border border-white/5 space-y-3 shadow-lg">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-white/5 pb-2">Round Scorecard</h4>
            <div className="space-y-2">
              {roster.map((p) => {
                const isPImposter = p.id === imposterId;
                const voteTargetId = votes[p.id];
                const voteTarget = roster.find((player) => player.id === voteTargetId);
                const pointsEarned = roundPoints[p.id] || 0;

                return (
                  <div key={p.id} className="flex justify-between items-center text-sm">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getPlayerColor(p.id) }} />
                        <span className="font-bold text-white">
                          {p.name} {isPImposter && <span className="text-xs text-bento-pink font-bold">(Imposter)</span>}
                        </span>
                      </div>
                      {!isPImposter && voteTarget && (
                        <p className="text-xs text-gray-400">
                          Voted for: <span className="text-gray-300 font-bold">{voteTarget.name}</span>{' '}
                          {voteTargetId === imposterId ? '✅' : '❌'}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={cn("text-xs font-black font-mono px-2 py-1 rounded", pointsEarned > 0 ? "bg-brodin-accent/10 text-brodin-accent border border-brodin-accent/20" : "bg-white/5 text-gray-400")}>
                        +{pointsEarned} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Next Actions */}
          {isHost ? (
            <div className="w-full space-y-2">
              <button
                onClick={() => setPhase('leaderboard')}
                className="w-full bg-brodin-accent hover:bg-brodin-accent/90 text-gray-950 rounded-lg py-3 font-black transition-colors uppercase tracking-wider text-sm"
              >
                View Final Leaderboard
              </button>
              <button
                onClick={handleNextRound}
                className="w-full bg-brodin-primary hover:bg-brodin-primaryDark text-white rounded-lg py-3 font-bold transition-colors uppercase tracking-wider text-sm"
              >
                Next Round
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center animate-pulse">Waiting for the host to proceed...</p>
          )}
        </div>
      )}

      {/* Leaderboard Screen */}
      {phase === 'leaderboard' && (
        <div className="w-full max-w-xl mx-auto px-4 flex flex-col items-center space-y-6 animate-fadeIn">
          <h2 className="font-display text-2xl font-black text-brodin-gold tracking-widest uppercase">
            Leaderboard
          </h2>

          {/* Ranking Board */}
          <div className="w-full bg-brodin-panel p-6 rounded-3xl border border-white/5 space-y-3 shadow-xl">
            {roster
              .map((p) => ({
                ...p,
                score: scores[p.id] || 0,
              }))
              .sort((a, b) => b.score - a.score)
              .map((p, idx) => {
                const isWinner = idx === 0;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex justify-between items-center p-3 rounded-2xl transition-all border",
                      isWinner
                        ? "bg-brodin-gold/10 border-brodin-gold/30 text-brodin-gold"
                        : "bg-brodin-field/40 border-transparent text-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-black text-lg w-6">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getPlayerColor(p.id) }} />
                        <span className="font-bold text-white">{p.name}</span>
                        {p.id === imposterId && <span className="text-[9px] uppercase tracking-wider font-bold bg-bento-pink/15 text-bento-pink px-1.5 py-0.5 rounded">Imposter</span>}
                      </div>
                    </div>
                    <span className="font-mono font-black text-lg">{p.score} pts</span>
                  </div>
                );
              })}
          </div>

          {/* Next Actions */}
          {isHost ? (
            <div className="w-full space-y-2">
              <button
                onClick={playAgain}
                className="w-full bg-brodin-primary hover:bg-brodin-primaryDark text-white rounded-lg py-3 font-bold transition-colors uppercase tracking-wider text-sm shadow-lg shadow-brodin-primary/20"
              >
                Return to Lobby (Play Again)
              </button>
              <button
                onClick={onQuit}
                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-3 font-semibold transition-colors uppercase tracking-wider text-sm"
              >
                Quit Game
              </button>
            </div>
          ) : (
            <div className="w-full space-y-4 text-center">
              <p className="text-xs text-gray-400 animate-pulse">Waiting for the host to restart...</p>
              <button onClick={onQuit} className="text-xs text-gray-400 underline">
                Disconnect
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
