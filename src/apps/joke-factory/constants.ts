import type { Prompt } from './types';

export const WRITING_DURATION_MS = 60000;
export const VOTING_DURATION_MS = 20000;
export const RESULTS_DURATION_MS = 10000;

export const PROMPTS: Prompt[] = [
  { id: '1', text: 'The worst name for a new perfume' },
  { id: '2', text: 'A name for a very untrustworthy airline' },
  { id: '3', text: 'Something you shouldn\'t say during a job interview' },
  { id: '4', text: 'The real reason the dinosaurs went extinct' },
  { id: '5', text: 'A terrible slogan for a brand of toilet paper' },
  { id: '6', text: 'The worst thing to hear from your pilot over the intercom' },
  { id: '7', text: 'What really happens when you turn off the lights in a room' },
  { id: '8', text: 'A weird warning label that should be on a cup of coffee' },
  { id: '9', text: 'The worst thing to find floating in your soup' },
  { id: '10', text: 'A name of a self-help book that will make you feel worse' },
  { id: '11', text: 'Something you shouldn\'t bring to a knife fight' },
  { id: '12', text: 'A suspicious ingredient in \'organic\' dog food' },
  { id: '13', text: 'The title of a very boring movie' },
  { id: '14', text: 'What cats are actually thinking when they stare at you' },
  { id: '15', text: 'The worst theme for a child\'s birthday party' },
  { id: '16', text: 'A bad name for a pet cemetery' },
  { id: '17', text: 'The secret ingredient in cafeteria mystery meat' },
  { id: '18', text: 'Something you shouldn\'t do while operating heavy machinery' },
  { id: '19', text: 'The worst thing to say to a police officer who pulled you over' },
  { id: '20', text: 'What you shouldn\'t use as a bookmark' },
  { id: '21', text: 'The worst place to fall asleep' },
  { id: '22', text: 'A terrible mascot for a professional sports team' },
  { id: '23', text: 'The worst thing to say right before a first kiss' },
  { id: '24', text: 'A name for a new brand of diet water' },
  { id: '25', text: 'Something you should never put in a microwave' },
  { id: '26', text: 'The worst thing to hear from your doctor during an exam' },
  { id: '27', text: 'The real reason aliens won\'t visit Earth' },
  { id: '28', text: 'A terrible name for a baby toy' },
  { id: '29', text: 'What you shouldn\'t say at a wedding toast' },
  { id: '30', text: 'The worst way to propose to someone' },
  { id: '31', text: 'A name for a very suspicious charity' },
  { id: '32', text: 'The worst job in a medieval castle' },
];

/**
 * Shuffles prompts and picks a set of N prompts for the round,
 * ensuring no duplicate prompts are picked.
 */
export function getRoundPrompts(count: number, usedIds: Set<string>): Prompt[] {
  const unused = PROMPTS.filter((p) => !usedIds.has(p.id));
  const pool = unused.length >= count ? unused : PROMPTS;
  
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
