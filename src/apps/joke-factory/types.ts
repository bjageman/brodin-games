export type JokeFactoryPhase =
  | 'starting'
  | 'prompt-reveal'
  | 'writing'
  | 'voting'
  | 'results'
  | 'leaderboard';

export interface Prompt {
  id: string;
  text: string;
}

export interface PromptMatchup {
  prompt: Prompt;
  leftPlayerId: string;
  rightPlayerId: string;
  leftAnswer: string;
  rightAnswer: string;
  votes: Record<string, 'left' | 'right'>; // voterId -> choice
}

export interface Round3State {
  prompt: Prompt;
  answers: Record<string, string>; // playerId -> answer
  votes: Record<string, string>; // voterId -> votedPlayerId
}

export interface GameState {
  phase: JokeFactoryPhase;
  round: number;
  playerPrompts: Record<string, Prompt[]>; // playerId -> prompts to answer
  playerAnswers: Record<string, Record<string, string>>; // playerId -> { promptId -> answer }
  matchups: PromptMatchup[];
  currentMatchIndex: number;
  round3Data: Round3State | null;
  scores: Record<string, number>; // playerId -> cumulative score
  roundPoints: Record<string, number>; // playerId -> points earned this round/matchup
  writingEndTimestamp: number | null;
  votingEndTimestamp: number | null;
  resultsEndTimestamp: number | null;
}
