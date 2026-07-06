import type { PlayerInfo } from '../../shared/types';

export type Category = 'noun' | 'verb' | 'adjective' | 'pronoun';

export const CATEGORIES: Category[] = ['noun', 'verb', 'adjective', 'pronoun'];

export type WordLibrary = Record<Category, string[]>;

export function emptyLibrary(): WordLibrary {
  return { noun: [], verb: [], adjective: [], pronoun: [] };
}

export interface TemplateBlank {
  id: string;
  category: Category;
}

export interface MadLibTemplate {
  id: string;
  title: string;
  text: string; // contains {{blankId}} placeholders
  blanks: TemplateBlank[];
}

export interface WordSourceAssignment {
  library: WordLibrary;
  contributorPlayerIds: string[];
  contributorNames: string[];
}

export interface PlayerAssignment extends WordSourceAssignment {
  template: MadLibTemplate;
}

export interface PlayerSheetResult {
  playerId: string;
  playerName: string;
  templateId: string;
  answers: Record<string, string>;
  contributors: string[];
  isBot?: boolean;
}

// This game's own private protocol, carried inside the shared Envelope
// alongside (never overlapping with) SharedMessageType.
export type MemoRandomMessageType =
  | 'round1-start'
  | 'word-library-submit'
  | 'word-library-ack'
  | 'round2-assignments'
  | 'sheet-submit'
  | 'sheet-submit-ack'
  | 'matchup-start'
  | 'vote-submit'
  | 'vote-submit-ack'
  | 'match-result'
  | 'winner-announced';

export interface Round1StartPayload {
  endTimestamp: number;
}

export interface WordLibrarySubmitPayload {
  library: WordLibrary;
}

export interface Round2AssignmentsPayload {
  assignments: Record<string, PlayerAssignment>;
  endTimestamp: number;
}

export interface SheetSubmitPayload {
  answers: Record<string, string>;
}

export type MatchupSide = 'left' | 'right';

export interface MatchupStartPayload {
  matchIndex: number;
  totalMatches: number;
  left: PlayerSheetResult;
  right: PlayerSheetResult;
  endTimestamp: number;
}

export interface VoteSubmitPayload {
  matchIndex: number;
  side: MatchupSide | null;
  final: boolean;
}

export interface VoteSubmitAckPayload {
  matchIndex: number;
}

export interface MatchResultPayload {
  matchIndex: number;
  totalMatches: number;
  left: PlayerSheetResult;
  right: PlayerSheetResult;
  leftVotes: number;
  rightVotes: number;
  scores: Record<string, number>;
  resultsEndTimestamp: number;
}

export interface WinnerPayload {
  winnerPlayerIds: string[];
  scores: Record<string, number>;
}

// Rendered only while GameShell has handed off to this game (its own phase
// is 'in-game'); doesn't need a 'join'/'joining'/'lobby' state of its own.
export type MemoRandomPhase =
  | 'starting'
  | 'round1'
  | 'round1-waiting'
  | 'round2'
  | 'round2-waiting'
  | 'round2-dropped'
  | 'matchup'
  | 'matchup-results'
  | 'winner';

export type { PlayerInfo };
