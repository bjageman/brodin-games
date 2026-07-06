import { type ComponentType } from 'react';
import MemoRandomGame from '../apps/memo-random/MemoRandomGame';
import FakeItGame from '../apps/fake-it/FakeItGame';
import { loadDictionary } from '../apps/memo-random/utils/dictionary';
import type { GamePlayProps } from './GameShell';

export interface GameConfig {
  id: string;
  title: string;
  minPlayers: number;
  maxPlayers: number;
  gamePlay: ComponentType<GamePlayProps>;
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
  },
};
