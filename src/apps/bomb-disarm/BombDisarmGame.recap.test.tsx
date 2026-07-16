import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemorizeView } from './components/BombViews';
import type { Card } from './types';

// Between rounds the just-cut cards ride into the memorize beat as a recap so the
// whole table can see what left the deck. These guard that scene: it shows the
// cut cards from round 2 on, and never leaks in on the opening deal.
const hand: Card[] = [
  { type: 'blank', revealed: false },
  { type: 'wire', revealed: false },
];

function renderMemorize(round: number, discardRecap: Card[] | null) {
  return render(
    <MemorizeView
      role="rebel"
      hand={hand}
      isDisplay={false}
      isHost
      round={round}
      wiresRevealed={0}
      playerCount={4}
      extraRebels={0}
      discardRecap={discardRecap}
      onReady={() => {}}
      onQuit={() => {}}
    />
  );
}

describe('MemorizeView discard recap', () => {
  it('shows the cut cards from the round that just ended', () => {
    const cut: Card[] = [
      { type: 'wire', revealed: true },
      { type: 'blank', revealed: true },
      { type: 'wire', revealed: true },
    ];
    renderMemorize(2, cut);
    expect(screen.getByText(/Cut last round/i)).toBeInTheDocument();
    // Both card faces are always in the DOM (a 3D flip hides one), so the recap
    // renders a face per cut card on top of the hand's own faces.
    expect(screen.getAllByText('Cut Wire').length).toBeGreaterThanOrEqual(2);
  });

  it('does not show the recap on the opening deal', () => {
    renderMemorize(1, null);
    expect(screen.queryByText(/Cut last round/i)).not.toBeInTheDocument();
  });

  it('does not show the recap when a smoke round left it anonymous', () => {
    renderMemorize(2, null);
    expect(screen.queryByText(/Cut last round/i)).not.toBeInTheDocument();
  });
});
