import { useEffect, useState, useCallback, useRef } from 'react';
import { loadSnapshot, saveSnapshot, gameSnapshotKey } from '../../shared/utils/sessionSnapshot';
import { useCountdown } from '../../shared/hooks/useCountdown';
import { DEBUG_MODE } from '../../shared/constants';
import type { Envelope } from '../../shared/types';
import type { GamePlayProps } from '../../shared/GameShell';
import type { GameState } from './types';
import { useDungeon } from './useDungeon';
import { useQuizQuestDebug } from './useQuizQuestDebug';
import PartyCard from './components/PartyCard';
import MenuOverlay from './components/MenuOverlay';
import QuestionView from './components/QuestionView';
import RevealView from './components/RevealView';
import GameOverView from './components/GameOverView';

interface QuizSnapshot {
  quiz: GameState;
}

const EMPTY: GameState = {
  phase: 'starting',
  dungeonLength: 0,
  room: null,
  players: {},
  answers: {},
  roundEndTimestamp: null,
  revealEndTimestamp: null,
  lastReveal: null,
  askedQuestionIds: [],
  winnerIds: [],
};

export default function QuizQuestGame({
  code, playerId, roster, isHost, freshStart, sendMessage, onRegisterMessageHandler, onQuit, onGameBgChange,
  onRegisterDebugActions,
}: GamePlayProps) {
  const restored = freshStart ? null : loadSnapshot<QuizSnapshot>(gameSnapshotKey(code))?.quiz ?? null;
  const [state, setState] = useState<GameState>({ ...EMPTY, ...restored });
  const [menuOpen, setMenuOpen] = useState(false);
  const { phase, room, players, answers, roundEndTimestamp, lastReveal, winnerIds } = state;

  useEffect(() => {
    const current = loadSnapshot<Record<string, unknown>>(gameSnapshotKey(code)) ?? {};
    saveSnapshot(gameSnapshotKey(code), { ...current, quiz: state });
  }, [code, state]);

  const publish = useCallback((next: GameState) => {
    setState(next);
    sendMessage({ type: 'quiz-state-update', timestamp: Date.now(), payload: next });
  }, [sendMessage]);

  const { startDungeon, submitAnswer, timeoutRound, timeoutReveal } = useDungeon({ roster, state, publish });

  // ---- Host: once the party has joined, move past the loading spinner ----
  // `freshStart` stays true for the rest of the session (it only marks a live
  // lobby->in-game transition vs. a refresh), so this must only ever fire
  // once — otherwise every later phase change (e.g. clicking "Enter the
  // Dungeon") re-triggers it and stomps the game right back to 'party'.
  const kickedOffRef = useRef(false);
  useEffect(() => {
    if (kickedOffRef.current) return;
    if (isHost && (state.phase === 'starting' || freshStart) && roster.length > 0) {
      kickedOffRef.current = true;
      const timer = setTimeout(() => {
        publish({ ...EMPTY, phase: 'party' });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isHost, freshStart, roster.length, publish, state.phase]);

  // ---- The answer window's countdown, and the host reaction once it ends ----
  const { msRemaining: roundMs, expired: roundExpired } = useCountdown(roundEndTimestamp);
  useEffect(() => {
    if (isHost && phase === 'question' && roundEndTimestamp && roundExpired) {
      timeoutRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, phase, roundEndTimestamp, roundExpired]);

  // ---- The reveal window's countdown, and the host reaction once it ends ----
  const { expired: revealExpired } = useCountdown(state.revealEndTimestamp);
  useEffect(() => {
    if (isHost && phase === 'reveal' && state.revealEndTimestamp && revealExpired) {
      timeoutReveal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, phase, state.revealEndTimestamp, revealExpired]);

  const { handleDebugHostAction, getDebugActions } = useQuizQuestDebug({
    isHost, playerId, roster, sendMessage, phase, room, answers, submitAnswer, timeoutRound,
  });

  // Register debug actions with GameShell
  useEffect(() => {
    if (DEBUG_MODE && onRegisterDebugActions) {
      onRegisterDebugActions(getDebugActions(), phase);
    }
  }, [phase, room, answers, onRegisterDebugActions, getDebugActions]);

  useEffect(() => {
    onRegisterMessageHandler((envelope: Envelope) => {
      if (envelope.type === 'quiz-state-update' && !isHost) {
        setState({ ...EMPTY, ...(envelope.payload as GameState) });
      } else if (envelope.type === 'quiz-request-state' && isHost) {
        if (state.phase !== 'starting') publish(state);
      } else if (envelope.type === 'quiz-answer' && isHost) {
        submitAnswer(envelope.playerId, (envelope.payload as { choiceIndex: number }).choiceIndex);
      } else if (envelope.type === 'quiz-debug-host-action' && isHost) {
        handleDebugHostAction((envelope.payload as { action: string }).action);
      }
    });
  });

  useEffect(() => {
    onGameBgChange?.('bg-quiz-bg');
    return () => onGameBgChange?.(null);
  }, [onGameBgChange]);

  // ---- Client: pick an answer ----
  function chooseAnswer(index: number) {
    if (phase !== 'question' || answers[playerId] !== undefined) return;
    if (isHost) submitAnswer(playerId, index);
    else sendMessage({ type: 'quiz-answer', playerId, timestamp: Date.now(), payload: { choiceIndex: index } });
  }

  const roundSec = Math.ceil(roundMs / 1000);

  return (
    <div className="w-full flex-1 flex flex-col items-center text-quiz-ink">
      {phase === 'starting' && (
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-quiz-gold border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {phase === 'party' && (
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-4 py-10 font-pixel">
          <h2 className="font-pixelBlock text-2xl uppercase text-quiz-gold [text-shadow:2px_2px_0_#000]">
            The Party Assembles
          </h2>
          <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
            {roster.map((p, i) => (
              <PartyCard key={p.id} name={p.name} index={i} />
            ))}
          </div>
          {isHost ? (
            <button
              onClick={startDungeon}
              className="border-2 border-quiz-gold bg-quiz-gold px-8 py-3 font-pixelBlock text-sm uppercase text-quiz-bg transition-colors hover:bg-quiz-goldDark hover:text-quiz-ink"
            >
              Enter the Dungeon
            </button>
          ) : (
            <p className="text-sm text-quiz-ink/70">Waiting for the host to start…</p>
          )}
          <button
            onClick={() => setMenuOpen(true)}
            className="border-2 border-quiz-gold px-6 py-2 font-pixelBlock text-xs uppercase text-quiz-gold transition-colors hover:bg-quiz-gold hover:text-quiz-bg"
          >
            Menu
          </button>
        </div>
      )}

      {phase === 'question' && room && (
        <QuestionView
          room={room}
          dungeonLength={state.dungeonLength}
          roster={roster}
          players={players}
          playerId={playerId}
          myAnswer={answers[playerId]}
          answeredCount={Object.keys(answers).length}
          secondsLeft={roundSec}
          onAnswer={chooseAnswer}
          onMenu={() => setMenuOpen(true)}
        />
      )}

      {phase === 'reveal' && room && lastReveal && (
        <RevealView
          room={room}
          dungeonLength={state.dungeonLength}
          reveal={lastReveal}
          roster={roster}
          players={players}
          playerId={playerId}
          onMenu={() => setMenuOpen(true)}
        />
      )}

      {phase === 'game-over' && (
        <GameOverView players={players} roster={roster} winnerIds={winnerIds} isHost={isHost} onQuit={onQuit} />
      )}

      {menuOpen && (
        <MenuOverlay code={code} playerCount={roster.length} onQuit={onQuit} onClose={() => setMenuOpen(false)} />
      )}
    </div>
  );
}
