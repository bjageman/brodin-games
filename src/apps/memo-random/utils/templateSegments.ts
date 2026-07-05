import type { Category, MadLibTemplate } from '../types';

export type TextSegment =
  | { kind: 'text'; value: string }
  | { kind: 'blank'; id: string; category: Category };

const BLANK_PATTERN = /\{\{(\w+)\}\}/g;

export function splitIntoSegments(template: MadLibTemplate): TextSegment[] {
  const categoryById = new Map(template.blanks.map((b) => [b.id, b.category]));
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  for (const match of template.text.matchAll(BLANK_PATTERN)) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: template.text.slice(lastIndex, match.index) });
    }
    const category = categoryById.get(match[1]);
    if (category) segments.push({ kind: 'blank', id: match[1], category });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < template.text.length) {
    segments.push({ kind: 'text', value: template.text.slice(lastIndex) });
  }
  return segments;
}
