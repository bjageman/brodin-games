import { useState, useEffect, type FormEvent } from 'react';
import type { PlayerInfo } from '../../../shared/types';
import type { JokeFactoryPhase, Prompt, PromptMatchup, Round3State } from '../types';

interface JokeFactoryViewsProps {
  phase: JokeFactoryPhase;
  round: number;
  roster: PlayerInfo[];
  playerId: string;
  isDisplay: boolean;
  isHost: boolean;
  prompts: Prompt[];
  writingSec: number;
  answersSubmitted: boolean;
  onSubmitAnswers: (answers: Record<string, string>) => void;
  submissionCount: number;
  
  // Voting and Results props
  matchups: PromptMatchup[];
  currentMatchIndex: number;
  votingSec: number;
  resultsSec: number;
  myVote: string | null; // left/right in R1/R2, targetPlayerId in R3
  onSubmitVote: (choice: string) => void;
  scores: Record<string, number>;
  handleNextRound: () => void;
  endGame: () => void;
  round3Data: Round3State | null;
}

export default function JokeFactoryViews({
  phase,
  round,
  roster,
  playerId,
  isDisplay,
  isHost,
  prompts,
  writingSec,
  answersSubmitted,
  onSubmitAnswers,
  submissionCount,
  
  matchups,
  currentMatchIndex,
  votingSec,
  resultsSec,
  myVote,
  onSubmitVote,
  scores,
  handleNextRound,
  endGame,
  round3Data,
}: JokeFactoryViewsProps) {
  const currentMatch = matchups[currentMatchIndex];
  
  const [shuffledR3Answers, setShuffledR3Answers] = useState<{ playerId: string; text: string }[]>([]);
  useEffect(() => {
    if (phase === 'voting' && round === 3 && round3Data) {
      const list = Object.entries(round3Data.answers).map(([pid, text]) => ({ playerId: pid, text }));
      const raf = requestAnimationFrame(() => setShuffledR3Answers(list.sort(() => Math.random() - 0.5)));
      return () => cancelAnimationFrame(raf);
    } else {
      const raf = requestAnimationFrame(() => setShuffledR3Answers([]));
      return () => cancelAnimationFrame(raf);
    }
  }, [phase, round, round3Data]);

  // Helper to format points
  const formatPoints = (pts: number) => `+${pts} pts`;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-xl mx-auto px-4 py-8 text-white font-display">
      {phase === 'starting' && (
        <div className="text-center space-y-4 animate-fade-in">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm tracking-widest text-yellow-400 font-bold uppercase">Preparing Joke Factory...</p>
        </div>
      )}

      {phase === 'prompt-reveal' && (
        <div className="text-center space-y-6 animate-pulse py-12">
          <h2 className="font-serifDisplay text-5xl font-extrabold text-yellow-400 uppercase tracking-wider">
            Round {round}
          </h2>
          <p className="text-lg text-gray-300 font-semibold tracking-wide">
            {round === 3 ? 'THE FINAL ROUND! (Double Points)' : 'Get ready to write your jokes!'}
          </p>
        </div>
      )}

      {phase === 'writing' && (
        <div className="w-full space-y-6">
          <div className="flex justify-between items-baseline border-b border-white/10 pb-4 mb-4">
            <h3 className="font-serifDisplay text-2xl font-bold text-yellow-400">
              Round {round}: Write!
            </h3>
            <span className="font-mono text-xl font-bold text-red-400 animate-pulse">
              {writingSec}s
            </span>
          </div>

          {isDisplay ? (
            <div className="bg-indigo-900/60 border border-yellow-400/20 rounded-3xl p-8 text-center space-y-4 shadow-xl">
              <p className="text-lg text-gray-300 font-semibold">Answers Submitted</p>
              <div className="text-6xl font-black text-yellow-400">
                {submissionCount} / {roster.length}
              </div>
              <div className="flex justify-center gap-1.5 pt-4">
                {roster.map((player) => (
                  <span
                    key={player.id}
                    className="w-2.5 h-2.5 rounded-full bg-white/20"
                  />
                ))}
              </div>
            </div>
          ) : answersSubmitted ? (
            <div className="bg-indigo-900/60 border border-yellow-400/20 rounded-3xl p-8 text-center space-y-3 shadow-xl">
              <p className="text-xl font-bold text-yellow-400">Answers Locked In! 🔒</p>
              <p className="text-sm text-gray-300">
                Waiting for the other funny people to finish typing...
              </p>
              <div className="pt-4 text-xs text-white/40">
                ({submissionCount} / {roster.length} submitted)
              </div>
            </div>
          ) : (
            <WritingInputForm prompts={prompts} onSubmit={onSubmitAnswers} />
          )}
        </div>
      )}

      {phase === 'voting' && (
        <div className="w-full space-y-6">
          <div className="flex justify-between items-baseline border-b border-white/10 pb-4 mb-4">
            <h3 className="font-serifDisplay text-xl font-bold text-yellow-400">
              {round === 3 ? 'The Final Battle!' : `Battle ${currentMatchIndex + 1} of ${matchups.length}`}
            </h3>
            <span className="font-mono text-xl font-bold text-red-400">
              {votingSec}s
            </span>
          </div>

          <div className="bg-indigo-900 border border-yellow-400/20 rounded-3xl p-6 text-center shadow-xl">
            <h4 className="font-serifDisplay text-2xl font-black leading-snug text-yellow-400">
              "{round === 3 ? round3Data?.prompt.text : currentMatch?.prompt.text}"
            </h4>
          </div>

          {round < 3 ? (
            // Rounds 1 & 2: Pairwise Matchups
            currentMatch && (() => {
              if (isDisplay) {
                return (
                  <div className="grid grid-cols-1 gap-4 w-full">
                    <div className="bg-indigo-900/60 border border-yellow-400/20 rounded-3xl p-6 text-center shadow-lg min-h-[100px] flex flex-col justify-center">
                      <span className="text-xs uppercase font-bold text-yellow-400/50 mb-1">Option A</span>
                      <span className="text-lg font-bold font-serifDisplay italic">"{currentMatch.leftAnswer}"</span>
                    </div>
                    <div className="bg-indigo-900/60 border border-yellow-400/20 rounded-3xl p-6 text-center shadow-lg min-h-[100px] flex flex-col justify-center">
                      <span className="text-xs uppercase font-bold text-yellow-400/50 mb-1">Option B</span>
                      <span className="text-lg font-bold font-serifDisplay italic">"{currentMatch.rightAnswer}"</span>
                    </div>
                    <p className="text-center text-sm text-yellow-400/80 animate-pulse mt-4 font-bold tracking-wide">
                      VOTE NOW ON YOUR DEVICE! 🗳️
                    </p>
                  </div>
                );
              }

              const isLeftAuthor = currentMatch.leftPlayerId === playerId;
              const isRightAuthor = currentMatch.rightPlayerId === playerId;
              const isAuthor = isLeftAuthor || isRightAuthor;

              if (isAuthor) {
                return (
                  <div className="bg-indigo-950/60 border border-white/15 rounded-3xl p-8 text-center space-y-3">
                    <p className="text-lg font-bold text-yellow-400/80">This is your battle! ⚔️</p>
                    <p className="text-sm text-gray-300">
                      You wrote one of these answers, so you cannot vote. Sitting tight!
                    </p>
                  </div>
                );
              }

              if (myVote) {
                return (
                  <div className="bg-indigo-900/40 border border-white/10 rounded-3xl p-8 text-center space-y-3">
                    <p className="text-lg font-bold text-yellow-400">Vote locked in! 🗳️</p>
                    <p className="text-sm text-gray-300">
                      Waiting for the other players to choose...
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => onSubmitVote('left')}
                    className="bg-indigo-900 border-2 border-yellow-400/30 hover:border-yellow-400 rounded-3xl p-6 text-left transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg flex flex-col justify-center min-h-[120px]"
                  >
                    <span className="text-xs uppercase font-bold text-yellow-400/50 mb-1">Option A</span>
                    <span className="text-lg font-bold font-serifDisplay italic">"{currentMatch.leftAnswer}"</span>
                  </button>

                  <button
                    onClick={() => onSubmitVote('right')}
                    className="bg-indigo-900 border-2 border-yellow-400/30 hover:border-yellow-400 rounded-3xl p-6 text-left transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg flex flex-col justify-center min-h-[120px]"
                  >
                    <span className="text-xs uppercase font-bold text-yellow-400/50 mb-1">Option B</span>
                    <span className="text-lg font-bold font-serifDisplay italic">"{currentMatch.rightAnswer}"</span>
                  </button>
                </div>
              );
            })()
          ) : (
            // Round 3: Multi-answer Vote
            round3Data && (() => {
              if (isDisplay) {
                return (
                  <div className="grid grid-cols-1 gap-3 w-full">
                    <p className="text-xs text-yellow-400/60 font-bold uppercase tracking-wider text-center mb-1 animate-pulse">
                      Vote for the funniest punchline on your device!
                    </p>
                    {shuffledR3Answers.map((ans) => (
                      <div
                        key={ans.playerId}
                        className="bg-indigo-900/60 border border-yellow-400/20 rounded-2xl p-4 text-center min-h-[60px] flex items-center justify-center shadow-lg"
                      >
                        <span className="text-lg font-bold font-serifDisplay italic">"{ans.text}"</span>
                      </div>
                    ))}
                  </div>
                );
              }

              if (myVote) {
                return (
                  <div className="bg-indigo-900/40 border border-white/10 rounded-3xl p-8 text-center space-y-3">
                    <p className="text-lg font-bold text-yellow-400">Vote locked in! 🗳️</p>
                    <p className="text-sm text-gray-300">
                      Waiting for the other players to choose...
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 gap-3 w-full">
                  <p className="text-xs text-yellow-400/60 font-bold uppercase tracking-wider text-center mb-1">
                    Vote for the funniest punchline (you cannot vote for your own!)
                  </p>
                  {shuffledR3Answers.map((ans) => {
                    const isOwn = ans.playerId === playerId;
                    return (
                      <button
                        key={ans.playerId}
                        disabled={isOwn}
                        onClick={() => onSubmitVote(ans.playerId)}
                        className={`border-2 rounded-2xl p-4 text-left transition-all shadow-md min-h-[70px] flex items-center justify-between ${
                          isOwn
                            ? 'bg-indigo-950/45 border-white/5 opacity-55 cursor-not-allowed'
                            : 'bg-indigo-900 border-yellow-400/20 hover:border-yellow-400 hover:scale-[1.01]'
                        }`}
                      >
                        <div className="pr-4 flex-1">
                          <span className="text-lg font-bold font-serifDisplay italic">"{ans.text}"</span>
                        </div>
                        {isOwn && (
                          <span className="text-[10px] uppercase font-bold text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full shrink-0">
                            Your Joke
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      )}

      {phase === 'results' && (
        <div className="w-full space-y-6">
          <div className="flex justify-between items-baseline border-b border-white/10 pb-4 mb-4">
            <h3 className="font-serifDisplay text-xl font-bold text-yellow-400">
              Battle Results
            </h3>
            <span className="font-mono text-xl font-bold text-yellow-400">
              {resultsSec}s
            </span>
          </div>

          <div className="bg-indigo-900 border border-yellow-400/20 rounded-3xl p-6 text-center shadow-xl">
            <h4 className="font-serifDisplay text-2xl font-black leading-snug text-yellow-400">
              "{round === 3 ? round3Data?.prompt.text : currentMatch?.prompt.text}"
            </h4>
          </div>

          {round < 3 ? (
            // Rounds 1 & 2: Pairwise Results
            currentMatch && (() => {
              const leftVotes = Object.values(currentMatch.votes).filter((v) => v === 'left').length;
              const rightVotes = Object.values(currentMatch.votes).filter((v) => v === 'right').length;
              const totalVotes = leftVotes + rightVotes;

              const leftAuthor = roster.find((p) => p.id === currentMatch.leftPlayerId)?.name || 'Unknown';
              const rightAuthor = roster.find((p) => p.id === currentMatch.rightPlayerId)?.name || 'Unknown';

              const ptsPerVote = 100;
              const bonusPts = 200;

              const leftPoints = leftVotes * ptsPerVote + (totalVotes > 0 && leftVotes === totalVotes ? bonusPts : 0);
              const rightPoints = rightVotes * ptsPerVote + (totalVotes > 0 && rightVotes === totalVotes ? bonusPts : 0);

              const leftCleanSweep = totalVotes > 0 && leftVotes === totalVotes;
              const rightCleanSweep = totalVotes > 0 && rightVotes === totalVotes;

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`border-2 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-xl ${leftCleanSweep ? 'bg-indigo-950 border-yellow-400' : 'bg-indigo-900 border-white/10'}`}>
                    <div>
                      <span className="text-xs uppercase font-bold text-yellow-400/60 block mb-1">
                        {leftAuthor}'s Joke
                      </span>
                      <p className="text-lg font-bold font-serifDisplay italic">"{currentMatch.leftAnswer}"</p>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-auto">
                      <span className="text-sm font-semibold tracking-wide">
                        {leftVotes} {leftVotes === 1 ? 'vote' : 'votes'}
                      </span>
                      <span className={`text-md font-extrabold ${leftPoints > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {leftPoints > 0 ? formatPoints(leftPoints) : '0 pts'}
                        {leftCleanSweep && <span className="block text-[10px] text-yellow-400 uppercase font-black tracking-widest mt-0.5">🔥 CLEAN SWEEP!</span>}
                      </span>
                    </div>
                  </div>

                  <div className={`border-2 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-xl ${rightCleanSweep ? 'bg-indigo-950 border-yellow-400' : 'bg-indigo-900 border-white/10'}`}>
                    <div>
                      <span className="text-xs uppercase font-bold text-yellow-400/60 block mb-1">
                        {rightAuthor}'s Joke
                      </span>
                      <p className="text-lg font-bold font-serifDisplay italic">"{currentMatch.rightAnswer}"</p>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-auto">
                      <span className="text-sm font-semibold tracking-wide">
                        {rightVotes} {rightVotes === 1 ? 'vote' : 'votes'}
                      </span>
                      <span className={`text-md font-extrabold ${rightPoints > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {rightPoints > 0 ? formatPoints(rightPoints) : '0 pts'}
                        {rightCleanSweep && <span className="block text-[10px] text-yellow-400 uppercase font-black tracking-widest mt-0.5">🔥 CLEAN SWEEP!</span>}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            // Round 3: Multi-answer Results
            round3Data && (() => {
              const totalVotes = Object.keys(round3Data.votes).length;
              
              // Calculate results for all players
              const resultsList = roster.map((p) => {
                const answerText = round3Data.answers[p.id] || 'Missed the deadline!';
                const vCount = Object.values(round3Data.votes).filter((v) => v === p.id).length;
                
                const ptsPerVote = 200; // Double points in R3!
                const bonusPts = 400; // bonus is +400 in R3!

                // Clean sweep = every OTHER voter picked p (p cannot vote for
                // self, so exclude p's own ballot from the denominator).
                const ownVoteCast = round3Data.votes[p.id] !== undefined ? 1 : 0;
                const sweepableVotes = totalVotes - ownVoteCast;
                const isCleanSweep = sweepableVotes > 0 && vCount === sweepableVotes;
                const pointsEarned = vCount * ptsPerVote + (isCleanSweep ? bonusPts : 0);

                return {
                  playerId: p.id,
                  name: p.name,
                  answerText,
                  votes: vCount,
                  points: pointsEarned,
                  isCleanSweep,
                };
              }).sort((a, b) => b.votes - a.votes); // highest votes first!

              return (
                <div className="space-y-4 w-full">
                  {resultsList.map((res) => (
                    <div
                      key={res.playerId}
                      className={`border-2 rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xl ${
                        res.isCleanSweep ? 'bg-indigo-950 border-yellow-400' : 'bg-indigo-900 border-white/5'
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="text-xs uppercase font-bold text-yellow-400/60 block">
                          {res.name}'s Joke
                        </span>
                        <p className="text-lg font-bold font-serifDisplay italic">"{res.answerText}"</p>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-white/10 pt-3 md:pt-0 shrink-0">
                        <span className="text-sm font-semibold tracking-wide text-gray-300">
                          {res.votes} {res.votes === 1 ? 'vote' : 'votes'}
                        </span>
                        <div className="text-right">
                          <span className={`text-md font-extrabold ${res.points > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                            {res.points > 0 ? formatPoints(res.points) : '0 pts'}
                          </span>
                          {res.isCleanSweep && (
                            <span className="block text-[9px] text-yellow-400 uppercase font-black tracking-widest mt-0.5">
                              🔥 CLEAN SWEEP!
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Leaderboard */}
      {phase === 'leaderboard' && (
        <div className="w-full space-y-6">
          <h2 className="font-serifDisplay text-4xl font-black text-center text-yellow-400 uppercase tracking-widest">
            {round < 3 ? `Round ${round} Standings` : 'Final Leaderboard'}
          </h2>

          <div className="bg-indigo-900 border border-yellow-400/25 rounded-3xl p-6 space-y-4 shadow-2xl">
            {roster
              .map((p) => ({ ...p, score: scores[p.id] ?? 0 }))
              .sort((a, b) => b.score - a.score)
              .map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between py-3.5 px-4 rounded-2xl ${idx === 0 ? 'bg-yellow-500 text-indigo-950 font-black' : 'bg-indigo-950/60 text-white font-semibold'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-mono">#{idx + 1}</span>
                    <span className="truncate">{p.name}</span>
                  </div>
                  <span className="font-mono">{p.score} pts</span>
                </div>
              ))}
          </div>

          {isHost ? (
            <div className="space-y-3 pt-4">
              {round < 3 ? (
                <button
                  onClick={handleNextRound}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-indigo-950 font-extrabold uppercase tracking-wider py-4 px-6 rounded-2xl shadow-xl transition-transform hover:scale-[1.02]"
                >
                  Start Round {round + 1}
                </button>
              ) : (
                <button
                  onClick={endGame}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-indigo-950 font-extrabold uppercase tracking-wider py-4 px-6 rounded-2xl shadow-xl transition-transform hover:scale-[1.02]"
                >
                  End Game
                </button>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-gray-400 animate-pulse pt-4">
              Waiting for the host to continue...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface WritingInputFormProps {
  prompts: Prompt[];
  onSubmit: (answers: Record<string, string>) => void;
}

function WritingInputForm({ prompts, onSubmit }: WritingInputFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleTextChange = (promptId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [promptId]: val }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const valid = prompts.every((p) => answers[p.id]?.trim());
    if (!valid) return;
    onSubmit(answers);
  };

  const allFilled = prompts.every((p) => answers[p.id]?.trim());

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {prompts.map((prompt, idx) => (
        <div
          key={prompt.id}
          className="bg-indigo-900 border border-yellow-400/20 rounded-3xl p-6 space-y-3.5 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="text-xs uppercase tracking-wider text-yellow-400/60 font-bold">
            Prompt {idx + 1} of {prompts.length}
          </div>
          <h4 className="font-serifDisplay text-xl font-bold leading-snug">
            {prompt.text}
          </h4>
          <input
            type="text"
            maxLength={100}
            required
            value={answers[prompt.id] ?? ''}
            onChange={(e) => handleTextChange(prompt.id, e.target.value)}
            placeholder="Type your punchline here..."
            className="w-full bg-indigo-950 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-white/20 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all shadow-inner"
          />
        </div>
      ))}

      <button
        type="submit"
        disabled={!allFilled}
        className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed text-indigo-950 font-extrabold uppercase tracking-wider py-4 px-6 rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        Submit Answers
      </button>
    </form>
  );
}
