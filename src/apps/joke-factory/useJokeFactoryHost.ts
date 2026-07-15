import { useRef } from 'react';
import type { PlayerInfo } from '../../shared/types';
import type { GameState, Prompt, PromptMatchup, Round3State } from './types';
import { getRoundPrompts } from './constants';

export interface HostRoundSetup {
  playerPrompts: Record<string, Prompt[]>;
  matchups: PromptMatchup[];
  round3Data: Round3State | null;
}

export function useJokeFactoryHost(
  roster: PlayerInfo[]
) {
  // Host-only bookkeeping refs
  const usedPromptIds = useRef<Set<string>>(new Set());

  // Initialize round: pick prompts and assign to players
  const startRound = (round: number): HostRoundSetup => {
    const N = roster.length;
    const playerPrompts: Record<string, Prompt[]> = {};
    const matchups: PromptMatchup[] = [];
    let round3Data: Round3State | null = null;

    if (round < 3) {
      // Pick N prompts for ring assignment
      const prompts = getRoundPrompts(N, usedPromptIds.current);
      prompts.forEach((p) => usedPromptIds.current.add(p.id));

      // Assign to players in a ring:
      // Player i gets prompt i and prompt i-1 (with wrap)
      roster.forEach((p, idx) => {
        const pCurrent = prompts[idx];
        const pPrev = prompts[(idx - 1 + N) % N];
        playerPrompts[p.id] = [pPrev, pCurrent];
      });
    } else {
      // Round 3: Single prompt for everyone
      const prompts = getRoundPrompts(1, usedPromptIds.current);
      prompts.forEach((p) => usedPromptIds.current.add(p.id));
      const singlePrompt = prompts[0];

      roster.forEach((p) => {
        playerPrompts[p.id] = [singlePrompt];
      });

      round3Data = {
        prompt: singlePrompt,
        answers: {},
        votes: {},
      };
    }

    return {
      playerPrompts,
      matchups,
      round3Data,
    };
  };

  return {
    startRound,
  };
}
