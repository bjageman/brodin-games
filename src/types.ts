export type Category = 'noun' | 'verb' | 'adjective' | 'pronoun';

export const CATEGORIES: Category[] = ['noun', 'verb', 'adjective', 'pronoun'];

export type WordLibrary = Record<Category, string[]>;

export function emptyLibrary(): WordLibrary {
  return { noun: [], verb: [], adjective: [], pronoun: [] };
}

export interface PlayerInfo {
  id: string;
  name: string;
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

export interface PlayerAssignment {
  library: WordLibrary;
  ownerPlayerId: string;
}

export interface PlayerSheetResult {
  playerId: string;
  playerName: string;
  templateId: string;
  answers: Record<string, string>;
  renderedText: string;
}

export type MessageType =
  | 'join-request'
  | 'join-ack'
  | 'roster-update'
  | 'round1-start'
  | 'word-library-submit'
  | 'word-library-ack'
  | 'round2-assignments'
  | 'sheet-submit'
  | 'sheet-submit-ack'
  | 'results'
  | 'vote-submit'
  | 'winner-announced';

export interface Envelope<T = unknown> {
  type: MessageType;
  playerId?: string;
  timestamp: number;
  payload: T;
}

export interface JoinRequestPayload {
  name: string;
}

export interface JoinAckPayload {
  accepted: boolean;
  reason?: string;
}

export interface RosterUpdatePayload {
  players: PlayerInfo[];
}

export interface Round1StartPayload {
  endTimestamp: number;
}

export interface WordLibrarySubmitPayload {
  library: WordLibrary;
}

export interface Round2AssignmentsPayload {
  assignments: Record<string, PlayerAssignment>;
  template: MadLibTemplate;
  endTimestamp: number;
}

export interface SheetSubmitPayload {
  answers: Record<string, string>;
}

export interface ResultsPayload {
  sheets: Record<string, PlayerSheetResult>;
  votingEndTimestamp: number;
}

export interface VoteSubmitPayload {
  targetPlayerId: string | null;
  final: boolean;
}

export interface WinnerPayload {
  winnerPlayerIds: string[];
  votes: Record<string, number>;
}

export type GamePhase =
  | 'join'
  | 'joining'
  | 'lobby'
  | 'round1'
  | 'round1-waiting'
  | 'round2'
  | 'round2-waiting'
  | 'round2-dropped'
  | 'voting'
  | 'winner';
