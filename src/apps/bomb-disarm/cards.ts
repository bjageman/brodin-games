import type { CardType, SpecialCardType } from './types';

export interface CardMeta {
  title: string;
  // Specials print their rule on the face; the three basic cards are all art.
  effectLabel?: 'When Revealed' | 'While Hidden';
  effect?: string;
  // The revealer reads the result off their own phone and keeps it to themselves.
  secret?: boolean;
}

export const CARD_META: Record<CardType, CardMeta> = {
  blank: { title: 'Blank' },
  wire: { title: 'Cut Wire' },
  explode: { title: 'Bomb' },
  silence: {
    title: 'Silence',
    effectLabel: 'While Hidden',
    effect: 'You cannot speak while this card is face-down in your hand. Once it is revealed you may speak again.',
    secret: true,
  },
  interrogate: {
    title: 'Interrogate',
    effectLabel: 'When Revealed',
    effect: 'Select a player and look at their role. Do not show to other players.',
    secret: true,
  },
  'rogue-agent': {
    title: 'Rogue Agent',
    effectLabel: 'When Revealed',
    effect: 'You choose every card that gets revealed for the rest of this round.',
  },
  'user-manual': {
    title: 'User Manual',
    effectLabel: 'When Revealed',
    effect: 'Reveal a card, then flip it back over. Its action does not trigger.',
  },
  'crossed-wires': {
    title: 'Crossed Wires',
    effectLabel: 'When Revealed',
    effect: 'Pick two cards from two different players and swap them. Nobody looks at them.',
  },
  'repair-kit': {
    title: 'Repair Kit',
    effectLabel: 'When Revealed',
    effect: 'Secretly add one extra Bomb or Cut Wire to next round’s deck. Does nothing in the final round.',
    secret: true,
  },
};

export const SPECIAL_CARD_TYPES: SpecialCardType[] = [
  'silence',
  'interrogate',
  'rogue-agent',
  'user-manual',
  'crossed-wires',
  'repair-kit',
];

export function isSpecial(type: CardType): type is SpecialCardType {
  return type !== 'blank' && type !== 'wire' && type !== 'explode';
}
