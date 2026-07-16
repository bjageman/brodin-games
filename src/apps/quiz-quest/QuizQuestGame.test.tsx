import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import QuizQuestGame from './QuizQuestGame';
import type { PlayerInfo } from '../../shared/types';

const roster: PlayerInfo[] = [{ id: 'host', name: 'Host' }, { id: 'p2', name: 'Guest' }];

function renderGame() {
  return render(
    <QuizQuestGame
      code="ABCD"
      playerId="host"
      name="Host"
      isHost
      roster={roster}
      isConnected
      sendMessage={vi.fn().mockResolvedValue(undefined)}
      isDisplay={false}
      freshStart
      onRegisterMessageHandler={() => {}}
      onQuit={() => {}}
    />
  );
}

describe('QuizQuestGame', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts the dungeon and stays on the question screen after "Enter the Dungeon" is clicked', () => {
    renderGame();

    // Host lands on 'starting', then the freshStart kickoff moves to 'party'.
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByText('The Party Assembles')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Enter the Dungeon'));

    // Nothing else should stomp the transition back to the party screen,
    // even once freshStart's one-shot kickoff effect re-runs on the phase change.
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.queryByText('The Party Assembles')).not.toBeInTheDocument();
    // We're on the question screen (the answer prompt only renders there).
    expect(screen.getByText(/Choose your answer/i)).toBeInTheDocument();
  });
});
