import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PlayerInfo } from '../../../shared/types';
import type { FakeItPhase, Topic } from '../types';
import FakeItScreens from './FakeItViews';

const TOPIC: Topic = { name: 'Flamingo', category: 'Animal' };

const ROSTER: PlayerInfo[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

/** Renders a screen as `playerId`, defaulting every prop the phase ignores. */
function renderScreen(phase: FakeItPhase, playerId: string, imposterId: string) {
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
      scores={{}}
      roundPoints={{}}
      isHost={false}
      handleNextRound={() => {}}
      setPhase={() => {}}
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
