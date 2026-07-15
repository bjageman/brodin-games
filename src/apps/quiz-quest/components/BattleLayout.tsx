import type { ReactNode } from 'react';
import type { PlayerInfo } from '../../../shared/types';
import type { ActiveRoom, PlayerCombat } from '../types';
import DungeonRoom from './DungeonRoom';
import PartyPanel from './PartyPanel';

// The persistent battle frame from the mockup, shared by the question and
// reveal phases: dungeon viewport over the round's content on the left, the
// party roster on the right, and a status/menu bar across the bottom. Only the
// lower-left slot (`children`) swaps between answering and the reveal.
export default function BattleLayout({
  room, dungeonLength, roster, players, playerId, secondsLeft, onMenu, children,
}: {
  room: ActiveRoom;
  dungeonLength: number;
  roster: PlayerInfo[];
  players: Record<string, PlayerCombat>;
  playerId: string;
  secondsLeft?: number;
  onMenu: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-2 font-pixel text-quiz-ink">
      <div className="grid gap-2 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-2">
          <DungeonRoom room={room} dungeonLength={dungeonLength} secondsLeft={secondsLeft} />
          {children}
        </div>
        <PartyPanel roster={roster} players={players} playerId={playerId} />
      </div>

      {/* Bottom bar: room/monster ability status (placeholder) + the menu. */}
      <div className="flex items-stretch gap-2">
        <div className="flex-1 border-2 border-quiz-goldDark bg-quiz-panel px-3 py-2 font-pixelBlock text-[10px] leading-relaxed text-quiz-ink/50">
          <p>ROOM EFFECT: <span className="text-quiz-ink/40">—</span></p>
          <p>MONSTER EFFECT: <span className="text-quiz-ink/40">—</span></p>
        </div>
        <button
          onClick={onMenu}
          className="border-2 border-quiz-gold bg-quiz-panel px-6 font-pixelBlock text-sm uppercase text-quiz-gold transition-colors hover:bg-quiz-gold hover:text-quiz-bg"
        >
          Menu
        </button>
      </div>
    </div>
  );
}
