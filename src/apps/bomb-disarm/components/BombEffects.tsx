import { cn } from '../../../shared/utils/cn';
import type { PlayerInfo } from '../../../shared/types';
import type { Card, EffectChoice, GameState, PendingEffect } from '../types';
import { CARD_META } from '../cards';
import { CardArt, LightningBolt } from './BombArt';
import { BombCard } from './BombBoard';

const OVERLAY = 'absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-bomb-bg/92 p-4 backdrop-blur-sm';

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-center font-display text-sm font-black uppercase tracking-widest text-bomb-bolt sm:text-base">
      {children}
    </h3>
  );
}

function PlayerPicker({ players, onPick }: { players: PlayerInfo[]; onPick: (id: string) => void }) {
  return (
    <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
      {players.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p.id)}
          className="rounded-full border-2 border-bomb-face bg-bomb-card px-4 py-1.5 font-display text-xs font-black uppercase tracking-wide text-white transition-transform hover:scale-105 sm:text-sm"
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

// Every phone only draws its own hand, so choosing a card on someone else's
// phone needs the whole table laid out here as face-down slots.
function CardPicker({ players, hands, chosen, onPick }: {
  players: PlayerInfo[];
  hands: Record<string, Card[]>;
  chosen: { playerId: string; cardIndex: number } | null;
  onPick: (playerId: string, cardIndex: number) => void;
}) {
  return (
    <div className="flex max-h-[62%] w-full max-w-2xl flex-col gap-1.5 overflow-y-auto">
      {players.map((p) => {
        const hand = hands[p.id] ?? [];
        if (!hand.some((c) => !c.revealed)) return null;
        return (
          <div key={p.id} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-right font-display text-[10px] font-black uppercase tracking-wide text-white sm:w-28 sm:text-xs">
              {p.name}
            </span>
            <div className="flex flex-1 gap-1.5">
              {hand.map((card, i) => {
                const isChosen = chosen?.playerId === p.id && chosen.cardIndex === i;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={card.revealed}
                    onClick={() => onPick(p.id, i)}
                    className={cn(
                      'flex h-7 flex-1 items-center justify-center rounded-md border-2 transition-transform sm:h-9',
                      card.revealed
                        ? 'border-white/10 bg-bomb-bg opacity-30'
                        : 'border-bomb-cardEdge bg-bomb-card hover:scale-105',
                      isChosen && 'border-bomb-bolt ring-2 ring-bomb-bolt'
                    )}
                  >
                    {!card.revealed && <span className="w-3.5"><LightningBolt /></span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function EffectPrompt({ effect, state, roster, onChoose }: {
  effect: PendingEffect;
  state: GameState;
  roster: PlayerInfo[];
  onChoose: (choice: EffectChoice) => void;
}) {
  const meta = CARD_META[effect.type];

  return (
    <div className={OVERLAY}>
      <div className="flex items-center gap-2">
        <span className="w-7"><CardArt type={effect.type} /></span>
        <Title>{meta.title}</Title>
      </div>

      {effect.type === 'interrogate' && (
        effect.role ? (
          <>
            <p className="text-center text-sm text-gray-200">
              <span className="font-black text-white">{effect.roleTargetName}</span> is a
            </p>
            <p className={cn(
              'font-display text-2xl font-black uppercase tracking-widest',
              effect.role === 'rebel' ? 'text-bomb-rebel' : 'text-bomb-wire'
            )}>
              {effect.role === 'rebel' ? '🧨 Rebel' : '🛡️ Peacekeeper'}
            </p>
            <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Keep it to yourself
            </p>
            <button
              type="button"
              onClick={() => onChoose({ kind: 'done' })}
              className="mt-1 rounded-full bg-bomb-bolt px-6 py-2 font-display text-xs font-black uppercase tracking-wider text-bomb-ink transition-transform hover:scale-105"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <p className="text-center text-xs text-gray-300 sm:text-sm">
              Pick a player and look at their role. Don't show anyone.
            </p>
            <PlayerPicker
              players={roster.filter((p) => p.id !== effect.actorId)}
              onPick={(id) => onChoose({ kind: 'player', playerId: id })}
            />
          </>
        )
      )}

      {effect.type === 'repair-kit' && (
        <>
          <p className="text-center text-xs text-gray-300 sm:text-sm">
            Secretly add one card to next round's deck.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onChoose({ kind: 'repair', cardType: 'wire' })}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-bomb-face bg-bomb-card px-6 py-3 transition-transform hover:scale-105"
            >
              <span className="w-8"><CardArt type="wire" /></span>
              <span className="font-display text-[10px] font-black uppercase tracking-wide text-white">Cut Wire</span>
            </button>
            <button
              type="button"
              onClick={() => onChoose({ kind: 'repair', cardType: 'explode' })}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-bomb-rebel bg-bomb-card px-6 py-3 transition-transform hover:scale-105"
            >
              <span className="w-8"><CardArt type="explode" /></span>
              <span className="font-display text-[10px] font-black uppercase tracking-wide text-white">Bomb</span>
            </button>
          </div>
        </>
      )}

      {effect.type === 'user-manual' && (
        <>
          <p className="text-center text-xs text-gray-300 sm:text-sm">
            Pick a card to turn over. It goes straight back, and its action won't fire.
          </p>
          <CardPicker
            players={roster}
            hands={state.hands}
            chosen={null}
            onPick={(pid, i) => onChoose({ kind: 'card', playerId: pid, cardIndex: i })}
          />
        </>
      )}

      {effect.type === 'crossed-wires' && (
        <>
          <p className="text-center text-xs text-gray-300 sm:text-sm">
            {effect.firstPick
              ? 'Now pick a card from a different player. They swap without anyone looking.'
              : 'Pick the first card to swap.'}
          </p>
          <CardPicker
            players={roster}
            hands={state.hands}
            chosen={effect.firstPick}
            onPick={(pid, i) => onChoose({ kind: 'card', playerId: pid, cardIndex: i })}
          />
        </>
      )}

      {effect.type === 'double-agent' && (
        <>
          <p className="text-center text-xs text-gray-300 sm:text-sm">
            The side that didn't make it to the table this game:
          </p>
          <p className={cn(
            'font-display text-2xl font-black uppercase tracking-widest',
            state.leftoverRole === 'rebel' ? 'text-bomb-rebel' : 'text-bomb-wire'
          )}>
            {state.leftoverRole === 'rebel' ? '🧨 Rebel' : '🛡️ Peacekeeper'}
          </p>
          <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Keep it to yourself
          </p>
          <div className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={() => onChoose({ kind: 'swap', swap: true })}
              className="rounded-full bg-bomb-bolt px-5 py-2 font-display text-xs font-black uppercase tracking-wider text-bomb-ink transition-transform hover:scale-105"
            >
              Swap to it
            </button>
            <button
              type="button"
              onClick={() => onChoose({ kind: 'swap', swap: false })}
              className="rounded-full border-2 border-white/30 px-5 py-2 font-display text-xs font-black uppercase tracking-wider text-gray-200 transition-colors hover:border-bomb-bolt hover:text-bomb-bolt"
            >
              Stay put
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function EffectWaiting({ effect, actorName }: { effect: PendingEffect; actorName: string }) {
  const meta = CARD_META[effect.type];
  return (
    <div className={OVERLAY}>
      <span className="w-10 animate-pulse"><CardArt type={effect.type} /></span>
      <Title>{meta.title}</Title>
      <p className="text-center text-sm text-gray-200">
        <span className="font-black text-white">{actorName}</span> is deciding…
      </p>
      {meta.secret && (
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Whatever they see, they keep
        </p>
      )}
    </div>
  );
}

export function PeekOverlay({ type, ownerName, seconds }: { type: Card['type']; ownerName: string; seconds: number }) {
  return (
    <div className={OVERLAY}>
      <Title>{ownerName}'s card</Title>
      <div className="h-[42%]">
        <BombCard card={{ type, revealed: true }} faceUp={false} />
      </div>
      <p className="text-center text-xs text-gray-300">
        Turning back over in <span className="font-black text-bomb-bolt">{seconds}s</span> — its action does not trigger.
      </p>
    </div>
  );
}
