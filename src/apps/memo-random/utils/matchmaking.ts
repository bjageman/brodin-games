import templatesData from '../data/templates.json';
import fallbackWordsData from '../data/fallbackWords.json';
import type { MadLibTemplate, PlayerSheetResult, WordLibrary } from '../types';

const TEMPLATES = templatesData as MadLibTemplate[];
const TEMPLATES_BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));
const FALLBACK_LIBRARY = fallbackWordsData as WordLibrary;

const BOT_NAMES = [
  'The Break Room Fridge',
  'HR (Automated)',
  'The Office Printer',
  'IT Support Ticket #4471',
  'The Fax Machine',
  'Building Security',
];

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getTemplateById(templateId: string): MadLibTemplate {
  return TEMPLATES_BY_ID.get(templateId) ?? TEMPLATES[0];
}

/**
 * Renders a fully-filled sheet from nobody in particular, so a solo player
 * (an odd one out, or the only one who made it to round 2) still gets a
 * real matchup instead of an automatic bye. Always uses the same template
 * as its human opponent, so the two sheets are actually comparable.
 */
export function generateBotSheet(templateId: string, index: number): PlayerSheetResult {
  const template = getTemplateById(templateId);
  const answers: Record<string, string> = {};
  for (const blank of template.blanks) {
    answers[blank.id] = randomFrom(FALLBACK_LIBRARY[blank.category]);
  }
  return {
    playerId: `bot-${index}`,
    playerName: randomFrom(BOT_NAMES),
    templateId: template.id,
    answers,
    contributors: [],
    isBot: true,
  };
}

export interface MatchPairing {
  templateId: string;
  playerIds: string[]; // 1 (odd one out, bot-filled later) or 2 entries
}

/**
 * Decided BEFORE round 2 starts: groups the roster into head-to-head pairs
 * and gives each pair the same template, while different pairs get
 * different templates (drawn without replacement as long as the template
 * pool is at least as big as the number of pairs). This is what makes the
 * two sheets in a later matchup actually comparable — both players wrote
 * about the same story. An odd player out gets a solo entry, matched
 * against a generated bot sheet on that same template once round 2
 * submissions are in.
 */
export function buildPairings(playerIds: string[]): MatchPairing[] {
  const shuffledPlayers = shuffle(playerIds);
  const shuffledTemplates = shuffle(TEMPLATES);
  const pairings: MatchPairing[] = [];
  for (let i = 0; i < shuffledPlayers.length; i += 2) {
    const pairPlayerIds = i + 1 < shuffledPlayers.length
      ? [shuffledPlayers[i], shuffledPlayers[i + 1]]
      : [shuffledPlayers[i]];
    const template = shuffledTemplates[pairings.length % shuffledTemplates.length];
    pairings.push({ templateId: template.id, playerIds: pairPlayerIds });
  }
  return pairings;
}

export interface Matchup {
  left: PlayerSheetResult;
  right: PlayerSheetResult;
}

/**
 * Turns the pre-decided pairings into final matchups once round 2 sheets
 * are in. A pairing whose partner never actually submitted (e.g. dropped
 * after a late round-1 submission) gets a generated bot opponent instead; a
 * pairing where nobody submitted is skipped entirely.
 */
export function buildMatchupsFromPairings(
  pairings: MatchPairing[],
  sheets: Map<string, PlayerSheetResult>
): Matchup[] {
  const matchups: Matchup[] = [];
  for (const pairing of pairings) {
    const present = pairing.playerIds
      .map((id) => sheets.get(id))
      .filter((s): s is PlayerSheetResult => !!s);
    if (present.length === 0) continue;
    const left = present[0];
    const right = present[1] ?? generateBotSheet(pairing.templateId, matchups.length);
    matchups.push({ left, right });
  }
  return matchups;
}
