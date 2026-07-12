import { type ComponentType } from 'react';
import MemoRandomGame from '../apps/memo-random/MemoRandomGame';
import FakeItGame from '../apps/fake-it/FakeItGame';
import FakeItLobby from '../apps/fake-it/components/FakeItLobby';
import BombDisarmGame from '../apps/bomb-disarm/BombDisarmGame';
import { loadDictionary } from '../apps/memo-random/utils/dictionary';
import type { GamePlayProps } from './GameShell';
import type { LobbyProps } from './components/Lobby';

export interface GameConfig {
  id: string;
  title: string;
  minPlayers: number;
  maxPlayers: number;
  gamePlay: ComponentType<GamePlayProps>;
  /** Overrides the shared lobby. Games without one get the default lobby. */
  lobby?: ComponentType<LobbyProps>;
  /** Page background while in this game's lobby. Defaults to the shared blue. */
  lobbyBgClassName?: string;
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
    lobbyBgClassName: 'bg-fakeit-light text-fakeit-ink',
  },
  'bomb-disarm': {
    id: 'bomb-disarm',
    title: 'Bomb Disarm',
    minPlayers: 3,
    maxPlayers: 10,
    gamePlay: BombDisarmGame,
  },
};
