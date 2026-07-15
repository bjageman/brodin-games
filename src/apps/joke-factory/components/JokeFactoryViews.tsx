import { useState, type FormEvent } from 'react';
import type { PlayerInfo } from '../../../shared/types';
import type { JokeFactoryPhase, Prompt } from '../types';

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
  onQuit: () => void;
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
  onQuit,
}: JokeFactoryViewsProps) {
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
            Get ready to write your jokes!
          </p>
        </div>
      )}

      {phase === 'writing' && (
        <div className="w-full space-y-6">
          {/* Header row with countdown and status */}
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

      {/* Fallback placeholders for remaining phases */}
      {['voting', 'results', 'leaderboard'].includes(phase) && (
        <div className="text-center py-12 space-y-4">
          <p className="text-yellow-400 text-lg font-bold">Phase: {phase.toUpperCase()}</p>
          <p className="text-gray-400 text-sm">Under development. Please wait...</p>
          {isHost && (
            <button
              onClick={onQuit}
              className="mt-6 rounded-full bg-red-500 hover:bg-red-600 text-white py-2 px-6 text-sm font-bold shadow-lg"
            >
              Quit Game
            </button>
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
    // Validate that we wrote answers for all prompts
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
