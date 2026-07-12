import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PlayerInfo } from '../../../shared/types';
import type { FakeItPhase, Topic } from '../types';
import FakeItScreens from './FakeItViews';

const TOPIC: Topic = { name: 'Flamingo', category: 'Animal' };

const ROSTER: PlayerInfo[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

interface Overrides {
  isHost?: boolean;
  endGame?: () => void;
  scores?: Record<string, number>;
}

/** Renders a screen as `playerId`, defaulting every prop the phase ignores. */
function renderScreen(
  phase: FakeItPhase,
  playerId: string,
  imposterId: string,
  overrides: Overrides = {}
) {
  return render(
    <FakeItScreens
      phase={phase}
      isImposter={playerId === imposterId}
      topic={TOPIC}
      revealSec={5}
      drawingRound={1}
      drawerIndex={0}
      roster={ROSTER}
      playerId={playerId}
      imposterId={imposterId}
      getPlayerColor={() => '#000000'}
      turnSec={20}
      turnMs={20000}
      voteSec={30}
      lines={[]}
      isMyTurn={false}
      handleDrawEnd={() => {}}
      myVote={null}
      handleVoteSubmit={() => {}}
      votes={{}}
      scores={overrides.scores ?? {}}
      roundPoints={{}}
      isHost={overrides.isHost ?? false}
      handleNextRound={() => {}}
      endGame={overrides.endGame ?? (() => {})}
      playAgain={() => {}}
      onQuit={() => {}}
    />
  );
}

describe.each(['role-reveal', 'drawing'] as const)('%s prompt', (phase) => {
  it('shows the imposter the category but never the word', () => {
    renderScreen(phase, 'p1', 'p1');

    expect(screen.getByText(/Category: Animal/)).toBeInTheDocument();
    expect(screen.queryByText('Flamingo')).not.toBeInTheDocument();
  });

  it('shows the artists both the word and the category', () => {
    renderScreen(phase, 'p2', 'p1');

    expect(screen.getByText('Flamingo')).toBeInTheDocument();
    expect(screen.getByText(/Category: Animal/)).toBeInTheDocument();
  });
});

describe('ending the game', () => {
  it("routes the host's end-game button through endGame, which broadcasts", () => {
    const endGame = vi.fn();

    renderScreen('results', 'p1', 'p2', { isHost: true, endGame });
    fireEvent.click(screen.getByRole('button', { name: /End game/ }));

    expect(endGame).toHaveBeenCalledTimes(1);
  });

  it('tells everyone the game is over and lists every final score', () => {
    renderScreen('leaderboard', 'p2', 'p1', { scores: { p1: 1500, p2: 500 } });

    expect(screen.getByText('Game Over')).toBeInTheDocument();
    expect(screen.getByText('Final Scores')).toBeInTheDocument();
    // Winner up top, everyone else in the list below — nobody omitted.
    expect(screen.getByText(/Winner: Alice/)).toBeInTheDocument();
    expect(screen.getByText('$1,500')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('$500')).toBeInTheDocument();
  });
});
