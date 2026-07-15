import { type ComponentType } from 'react';
import MemoRandomGame from '../apps/memo-random/MemoRandomGame';
import FakeItGame from '../apps/fake-it/FakeItGame';
import FakeItLobby from '../apps/fake-it/components/FakeItLobby';
import BombDisarmGame from '../apps/bomb-disarm/BombDisarmGame';
import BombLobbySettings from '../apps/bomb-disarm/components/BombLobbySettings';
import BombBadge from '../apps/bomb-disarm/components/BombBadge';
import QuizQuestGame from '../apps/quiz-quest/QuizQuestGame';
import QuizTag from '../apps/quiz-quest/components/QuizTag';
import { loadDictionary } from '../apps/memo-random/utils/dictionary';
import type { GamePlayProps } from './GameShell';
import type { LobbyExtraProps, LobbyProps, PlayerTagProps } from './components/Lobby';

/**
 * Palette for the chrome *around* a game — the host's create-room page, the
 * room-code modal, the lobby. Without this every game wore the same dark blue,
 * so Fake It's warm gallery look broke the moment you opened the join modal.
 */
export interface GameTheme {
  /** Lobby page background + text. */
  lobbyBg: string;
  /** Host "create room" page background + text. */
  pageBg: string;
  /** Card / modal surface. */
  panel: string;
  /** Text input surface. */
  field: string;
  /** Primary button. */
  accent: string;
  /** Room-code characters. */
  code: string;
  /** Secondary / helper text. */
  muted: string;
  /** Page title + divider. */
  heading: string;
}

/**
 * Matches the homepage: white page, cyan surfaces, the "PLAY NOW" blue for
 * primary actions, near-black ink. Coming off a bright homepage into dark navy
 * chrome was a jarring seam, so this is what a game gets unless it says
 * otherwise.
 *
 * Note this themes the chrome *around* a game (create-room page, lobby,
 * room-code modal). The in-game screens still run on the game's own background
 * — Memo-Random and Bomb Disarm remain dark — so `heading` is only applied
 * in-game when a game supplies a matching background of its own.
 */
export const DEFAULT_THEME: GameTheme = {
  lobbyBg: 'bg-home-cyan text-home-ink',
  pageBg: 'bg-white text-home-ink',
  panel: 'bg-home-cyan border-home-ink/15 text-home-ink',
  field: 'bg-white border-home-ink/25 text-home-ink focus:border-home-play',
  accent: 'bg-home-play hover:brightness-95 text-white',
  code: 'text-home-ink',
  muted: 'text-home-ink/70',
  heading: 'text-home-ink',
};

const FAKE_IT_THEME: GameTheme = {
  lobbyBg: 'bg-fakeit-light text-fakeit-ink',
  pageBg: 'bg-fakeit-light text-fakeit-ink',
  panel: 'bg-fakeit-panel border-fakeit-ink/40 text-fakeit-dark',
  field: 'bg-white border-fakeit-ink/40 text-fakeit-dark focus:border-fakeit-button',
  accent: 'bg-fakeit-button hover:bg-fakeit-ink text-white',
  code: 'text-fakeit-dark',
  muted: 'text-fakeit-dark/70',
  heading: 'text-fakeit-ink',
};

const BOMB_THEME: GameTheme = {
  lobbyBg: 'bg-bomb-bg text-white',
  pageBg: 'bg-bomb-bg text-white',
  panel: 'bg-bomb-board border-white/15 text-white',
  field: 'bg-bomb-bg border-white/25 text-white focus:border-bomb-bolt',
  accent: 'bg-bomb-bolt hover:brightness-95 text-bomb-ink',
  code: 'text-bomb-bolt',
  muted: 'text-white/70',
  heading: 'text-white',
};

const QUIZ_THEME: GameTheme = {
  lobbyBg: 'bg-quiz-bg text-quiz-ink',
  pageBg: 'bg-quiz-bg text-quiz-ink',
  panel: 'bg-quiz-stone border-quiz-gold/40 text-quiz-ink',
  field: 'bg-quiz-panel border-quiz-gold/40 text-quiz-ink focus:border-quiz-gold',
  accent: 'bg-quiz-gold hover:brightness-95 text-quiz-bg',
  code: 'text-quiz-gold',
  muted: 'text-quiz-ink/70',
  heading: 'text-quiz-ink',
};

export interface GameConfig {
  id: string;
  title: string;
  minPlayers: number;
  maxPlayers: number;
  gamePlay: ComponentType<GamePlayProps>;
  /** Overrides the shared lobby. Games without one get the default lobby. */
  lobby?: ComponentType<LobbyProps>;
  /** Host-only pre-game options, rendered inside the shared lobby. */
  lobbyExtra?: ComponentType<LobbyExtraProps>;
  /** Overrides the sticky-note player tag in the shared lobby's roster grid. */
  playerTag?: ComponentType<PlayerTagProps>;
  /** Colours the chrome around the game. Falls back to DEFAULT_THEME. */
  theme?: GameTheme;
  onIdlePrefetch?: () => void;
}

export const GAMES_REGISTRY: Record<string, GameConfig> = {
  'memo-random': {
    id: 'memo-random',
    title: 'Memo-Random',
    minPlayers: 4,
    maxPlayers: 12,
    gamePlay: MemoRandomGame,
    onIdlePrefetch: loadDictionary,
  },
  'fake-it': {
    id: 'fake-it',
    title: 'Fake It',
    minPlayers: 3,
    maxPlayers: 12,
    gamePlay: FakeItGame,
    lobby: FakeItLobby,
    theme: FAKE_IT_THEME,
  },
  'bomb-disarm': {
    id: 'bomb-disarm',
    title: 'Bomb Disarm',
    minPlayers: 3,
    maxPlayers: 10,
    gamePlay: BombDisarmGame,
    lobbyExtra: BombLobbySettings,
    playerTag: BombBadge,
    theme: BOMB_THEME,
  },
  'quiz-quest': {
    id: 'quiz-quest',
    title: 'Quiz Quest',
    // Playable solo — a lone player just has nobody to out-score, only the
    // boss to beat.
    minPlayers: 1,
    maxPlayers: 6,
    gamePlay: QuizQuestGame,
    playerTag: QuizTag,
    theme: QUIZ_THEME,
  },
};
