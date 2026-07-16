import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiscardRecapView } from './components/BombViews';
import type { Card } from './types';

function renderDiscardRecap(round: number, discardRecap: Card[] | null, isHost: boolean = true) {
  return render(
    <DiscardRecapView
      isHost={isHost}
      isDisplay={false}
      round={round}
      discardRecap={discardRecap}
      onStartNextRound={() => {}}
      onQuit={() => {}}
    />
  );
}

describe('DiscardRecapView', () => {
  it('shows the cut cards from the round that just ended', () => {
    const cut: Card[] = [
      { type: 'wire', revealed: true },
      { type: 'blank', revealed: true },
    ];
    renderDiscardRecap(2, cut);
    expect(screen.getByText(/Round 1 ended/i)).toBeInTheDocument();
    expect(screen.getByText(/Discarded last round:/i)).toBeInTheDocument();
    
    // Check that cut cards are visible in the DOM
    expect(screen.getAllByText('Cut Wire').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Blank').length).toBeGreaterThanOrEqual(1);
  });

  it('shows the Start Next Round button for the host', () => {
    renderDiscardRecap(2, [], true);
    expect(screen.getByRole('button', { name: /Start Next Round/i })).toBeInTheDocument();
  });

  it('shows a wait message for non-host players', () => {
    renderDiscardRecap(2, [], false);
    expect(screen.getByText(/Waiting for host to start/i)).toBeInTheDocument();
  });
});
