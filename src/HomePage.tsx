import type { ReactNode } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import PageLayout from './shared/components/PageLayout';
import { cn } from './shared/utils/cn';

type BentoColor = 'teal' | 'pink' | 'pinkLight' | 'blue';
type BentoShape = 'sm' | 'wide' | 'tall';

interface GameTile {
  id: string;
  title: string;
  description: string;
  href?: string;
  color: BentoColor;
  shape: BentoShape;
}

// Layout is a 4-column bento grid (at lg). With `grid-flow-dense`, this order of
// spans reproduces the reference mockup: Join + Memo + a wide pink banner across
// the top, then three tall cards with a short card tucking into the gap beneath
// the middle column.
const GAMES: GameTile[] = [
  {
    id: 'memo-random',
    title: 'Memo-Random',
    description: "Race the clock to type words, then fill in someone else's memo with them.",
    href: '#/host',
    color: 'teal',
    shape: 'sm',
  },
  { id: 'reply-all-royale', title: 'Reply-All Royale', description: 'Coming soon.', color: 'pink', shape: 'wide' },
  { id: 'meeting-bingo', title: 'Meeting Bingo', description: 'Coming soon.', color: 'blue', shape: 'tall' },
  { id: 'cubicle-chaos', title: 'Cubicle Chaos', description: 'Coming soon.', color: 'blue', shape: 'sm' },
  { id: 'water-cooler-wars', title: 'Water Cooler Wars', description: 'Coming soon.', color: 'blue', shape: 'tall' },
  { id: 'the-standup', title: 'The Standup', description: 'Coming soon.', color: 'pinkLight', shape: 'tall' },
  { id: 'budget-battle', title: 'Budget Battle', description: 'Coming soon.', color: 'pink', shape: 'sm' },
  { id: 'out-of-office', title: 'Out of Office', description: 'Coming soon.', color: 'pink', shape: 'wide' },
  { id: 'icebreaker-inferno', title: 'Icebreaker Inferno', description: 'Coming soon.', color: 'blue', shape: 'sm' },
  { id: 'password-roulette', title: 'Password Roulette', description: 'Coming soon.', color: 'pinkLight', shape: 'tall' },
  { id: 'guess-the-boss', title: 'Guess the Boss', description: 'Coming soon.', color: 'teal', shape: 'sm' },
  { id: 'fib-or-fact', title: 'Fib or Fact', description: 'Coming soon.', color: 'blue', shape: 'wide' },
];

const COLOR_BG: Record<BentoColor, string> = {
  teal: 'bg-bento-teal',
  pink: 'bg-bento-pink',
  pinkLight: 'bg-bento-pinkLight',
  blue: 'bg-bento-blue',
};

const SHAPE_SPAN: Record<BentoShape, string> = {
  sm: '',
  wide: 'lg:col-span-2',
  tall: 'lg:row-span-2',
};

function CircleBadge({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <div
      className={cn(
        'w-8 h-8 rounded-full border flex items-center justify-center shrink-0',
        muted ? 'border-white/40 text-white/60' : 'border-white text-white'
      )}
    >
      {children}
    </div>
  );
}

function StickyNote({ text }: { text: string }) {
  return (
    <div className="relative -rotate-2 rounded-sm bg-bento-cream px-3 py-2.5 shadow-md">
      <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-bento-pin shadow-sm ring-2 ring-white/40" />
      <p className="text-[11px] font-bold leading-snug text-[#1e191b]">{text}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <PageLayout
      title="Brodin Games"
      bgClassName="bg-bento-navy"
      headerClassName="text-white"
      dividerClassName="text-white"
      footerClassName="text-white/60"
    >
      <div className="w-full">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:auto-rows-[200px] xl:auto-rows-[224px] lg:grid-flow-dense">
          {/* Join Game — the white entry tile */}
          <a
            href="#/join"
            className="group flex min-h-[164px] items-center justify-center rounded-3xl bg-white p-4 transition-transform hover:scale-[1.02]"
          >
            <span className="text-center font-display text-xl font-extrabold uppercase leading-tight tracking-[0.2em] text-bento-text">
              Join
              <br />
              Game
            </span>
          </a>

          {GAMES.map((game) => {
            const spanClass = SHAPE_SPAN[game.shape];
            const isLive = Boolean(game.href);
            const inner = (
              <>
                <h2 className="font-display text-base font-bold leading-tight text-white sm:text-lg">
                  {game.title}
                </h2>

                {isLive && (
                  <div className="mt-2">
                    <StickyNote text={game.description} />
                  </div>
                )}

                <div className="mt-2 flex flex-1 items-end justify-end">
                  <CircleBadge muted={!isLive}>
                    {isLive ? <ArrowRight className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
                  </CircleBadge>
                </div>
              </>
            );

            const cardClass = cn(
              'relative flex min-h-[164px] flex-col overflow-hidden rounded-3xl p-4',
              COLOR_BG[game.color],
              spanClass,
              isLive
                ? 'transition-transform hover:scale-[1.02]'
                : 'cursor-not-allowed opacity-90'
            );

            return isLive ? (
              <a key={game.id} href={game.href} className={cardClass}>
                {inner}
              </a>
            ) : (
              <div key={game.id} className={cardClass} aria-disabled="true">
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </PageLayout>
  );
}
