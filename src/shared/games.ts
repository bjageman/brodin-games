import { type ComponentType } from 'react';
import MemoRandomGame from '../apps/memo-random/MemoRandomGame';
import FakeItGame from '../apps/fake-it/FakeItGame';
import FakeItLobby from '../apps/fake-it/components/FakeItLobby';
import BombDisarmGame from '../apps/bomb-disarm/BombDisarmGame';
import { loadDictionary } from '../apps/memo-random/utils/dictionary';
import type { GamePlayProps } from './GameShell';
import type { LobbyProps } from './components/Lobby';

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

export const DEFAULT_THEME: GameTheme = {
  lobbyBg: 'bg-[#6d97ee] text-[#2b2f74]',
  pageBg: 'bg-brodin-bg text-gray-100',
  panel: 'bg-brodin-panel border-brodin-primary/30',
  field: 'bg-brodin-field border-brodin-primary/40 text-white focus:border-brodin-accent',
  accent: 'bg-brodin-primary hover:bg-brodin-primaryDark text-white',
  code: 'text-brodin-accent',
  muted: 'text-gray-300',
  heading: 'text-brodin-accent',
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

export interface GameConfig {
  id: string;
  title: string;
  minPlayers: number;
  maxPlayers: number;
  gamePlay: ComponentType<GamePlayProps>;
  /** Overrides the shared lobby. Games without one get the default lobby. */
  lobby?: ComponentType<LobbyProps>;
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
  },
};
