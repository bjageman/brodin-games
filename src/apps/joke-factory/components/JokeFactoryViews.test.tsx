import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PlayerInfo } from '../../../shared/types';
import type { Prompt, PromptMatchup } from '../types';
import JokeFactoryViews from './JokeFactoryViews';

const ROSTER: PlayerInfo[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
  { id: 'p3', name: 'Cara' },
];

const PROMPTS: Prompt[] = [
  { id: '1', text: 'The worst name for a new perfume' },
  { id: '2', text: 'A name for a very untrustworthy airline' },
];

const MATCHUPS: PromptMatchup[] = [
  {
    prompt: PROMPTS[0],
    leftPlayerId: 'p1',
    rightPlayerId: 'p2',
    leftAnswer: 'Sweat & Tears',
    rightAnswer: 'Crash & Burn',
    votes: {},
  },
];

describe('JokeFactoryViews isDisplay rendering', () => {
  it('renders submission count in writing phase when isDisplay is true', () => {
    render(
      <JokeFactoryViews
        phase="writing"
        round={1}
        roster={ROSTER}
        playerId="host"
        isDisplay={true}
        isHost={true}
        prompts={[]}
        writingSec={60}
        answersSubmitted={false}
        onSubmitAnswers={() => {}}
        submissionCount={1}
        matchups={[]}
        currentMatchIndex={0}
        votingSec={20}
        resultsSec={10}
        myVote={null}
        onSubmitVote={() => {}}
        scores={{}}
        handleNextRound={() => {}}
        endGame={() => {}}
        round3Data={null}
      />
    );

    expect(screen.getByText('Answers Submitted')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Type your punchline here...')).not.toBeInTheDocument();
  });

  it('renders static options without clickable buttons in voting phase when isDisplay is true', () => {
    render(
      <JokeFactoryViews
        phase="voting"
        round={1}
        roster={ROSTER}
        playerId="host"
        isDisplay={true}
        isHost={true}
        prompts={[]}
        writingSec={0}
        answersSubmitted={false}
        onSubmitAnswers={() => {}}
        submissionCount={3}
        matchups={MATCHUPS}
        currentMatchIndex={0}
        votingSec={20}
        resultsSec={10}
        myVote={null}
        onSubmitVote={() => {}}
        scores={{}}
        handleNextRound={() => {}}
        endGame={() => {}}
        round3Data={null}
      />
    );

    expect(screen.getByText(/"Sweat & Tears"/)).toBeInTheDocument();
    expect(screen.getByText(/"Crash & Burn"/)).toBeInTheDocument();
    expect(screen.getByText('VOTE NOW ON YOUR DEVICE! 🗳️')).toBeInTheDocument();
    // Buttons should not be present as clickable elements for Option A/B
    const buttons = screen.queryAllByRole('button');
    expect(buttons.length).toBe(0);
  });

  it('renders interactive option buttons in voting phase for players (isDisplay is false)', () => {
    const onSubmitVote = vi.fn();
    render(
      <JokeFactoryViews
        phase="voting"
        round={1}
        roster={ROSTER}
        playerId="p3" // Alice and Bob are authors, Cara is voter
        isDisplay={false}
        isHost={false}
        prompts={[]}
        writingSec={0}
        answersSubmitted={false}
        onSubmitAnswers={() => {}}
        submissionCount={3}
        matchups={MATCHUPS}
        currentMatchIndex={0}
        votingSec={20}
        resultsSec={10}
        myVote={null}
        onSubmitVote={onSubmitVote}
        scores={{}}
        handleNextRound={() => {}}
        endGame={() => {}}
        round3Data={null}
      />
    );

    const buttonA = screen.getByRole('button', { name: /Option A/i });
    const buttonB = screen.getByRole('button', { name: /Option B/i });

    expect(buttonA).toBeInTheDocument();
    expect(buttonB).toBeInTheDocument();

    fireEvent.click(buttonA);
    expect(onSubmitVote).toHaveBeenCalledWith('left');
  });
});
