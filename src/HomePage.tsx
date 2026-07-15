import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, Lock, Search, SlidersHorizontal, Star, Users } from 'lucide-react';
import { cn } from './shared/utils/cn';

type Tone = 'cyan' | 'pink';

interface Game {
  id: string;
  title: string;
  description: string;
  art: string;
  tone: Tone;
  // Supported party size. Mirrors each game's config in the games registry;
  // kept inline so the homepage stays a light bundle (it never imports the
  // game modules themselves).
  minPlayers: number;
  maxPlayers: number;
  /** Omitted for games that aren't playable yet. */
  href?: string;
  /** The single newest game — surfaced in the "Newest" spotlight. */
  newest?: boolean;
}

// Order matches the mockup: cyan/pink alternate down the grid.
const GAMES: Game[] = [
  {
    id: 'fake-it',
    title: 'Fake It',
    description: 'Draw something together but one of you is the imposter!',
    art: '/games/fake-it.png',
    tone: 'cyan',
    minPlayers: 3,
    maxPlayers: 12,
    href: '#/host?game=fake-it',
  },
  {
    id: 'bomb-disarm',
    title: 'Bomb Disarm',
    description: 'Disarm a Bomb but be careful of the traitors among you!',
    art: '/games/bomb-disarm.png',
    tone: 'pink',
    minPlayers: 3,
    maxPlayers: 10,
    href: '#/host?game=bomb-disarm',
  },
  {
    id: 'memo-random',
    title: 'Memo-Random',
    description: 'Send a company-wide message with the limited options your coworkers send you',
    art: '/games/memo-random.png',
    tone: 'pink',
    minPlayers: 4,
    maxPlayers: 12,
    href: '#/host?game=memo-random',
  },
  {
    id: 'joke-factory',
    title: 'Joke Factory',
    description: 'Assess the best jokes before they get released to the public.',
    art: '/games/joke-factory.png',
    tone: 'cyan',
    minPlayers: 3,
    maxPlayers: 8,
    href: '#/host?game=joke-factory',
  },
  {
    id: 'quiz-quest',
    title: 'Quiz Quest',
    description: 'Team up to trivia your way through a dungeon full of monsters and a boss at the end.',
    art: '/quiz-quest/portraits/human_fighter_male_plate.jpg',
    tone: 'pink',
    minPlayers: 1,
    maxPlayers: 8,
    href: '#/host?game=quiz-quest',
    newest: true,
  },
];

const TONE_BG: Record<Tone, string> = {
  cyan: 'bg-home-cyan',
  pink: 'bg-home-pink',
};

// The largest party any game supports — the top of the filter's range.
const MAX_PLAYERS = Math.max(...GAMES.map((g) => g.maxPlayers));

function playerRange(game: Game): string {
  return game.minPlayers === game.maxPlayers
    ? `${game.minPlayers}`
    : `${game.minPlayers}-${game.maxPlayers}`;
}

// Player-count badge for a game's corner: a group icon plus the supported range.
function PlayerBadge({ game }: { game: Game }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-1 text-xs font-bold text-home-ink shadow-sm backdrop-blur-sm"
      title={`Plays with ${playerRange(game)} players`}
    >
      <Users className="h-3.5 w-3.5" aria-hidden="true" />
      {playerRange(game)}
      <span className="sr-only"> players</span>
    </span>
  );
}

function Stars() {
  return (
    <div className="flex gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className="h-4 w-4 fill-home-star text-home-star" />
      ))}
    </div>
  );
}

function GameCard({ game }: { game: Game }) {
  const playable = Boolean(game.href);

  const body = (
    <>
      <div className="absolute left-3 top-3 z-10">
        <PlayerBadge game={game} />
      </div>

      <div className="flex h-36 items-center justify-center sm:h-44">
        <img
          src={game.art}
          alt=""
          loading="lazy"
          className={cn('max-h-full max-w-full object-contain', !playable && 'opacity-60')}
        />
      </div>

      <h3 className="mt-3 font-display text-lg font-bold leading-tight text-home-ink">
        {game.title}
      </h3>

      {playable ? (
        <Stars />
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-home-ink/60">
          <Lock className="h-3 w-3" /> Coming soon
        </span>
      )}

      <p className="mt-1 text-sm leading-snug text-home-ink/80">{game.description}</p>
    </>
  );

  const shell = cn(
    'relative flex flex-col rounded-3xl p-4',
    TONE_BG[game.tone],
    playable
      ? 'transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-ink'
      : 'cursor-not-allowed'
  );

  return playable ? (
    <a href={game.href} className={shell}>
      {body}
    </a>
  ) : (
    <div className={shell} aria-disabled="true">
      {body}
    </div>
  );
}

function Spotlight({ game }: { game: Game }) {
  return (
    <a
      href={game.href}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-home-featured p-5 transition-transform hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-ink sm:flex-row sm:items-center sm:gap-6"
    >
      <div className="absolute left-4 top-4 z-10">
        <PlayerBadge game={game} />
      </div>

      <div className="flex h-40 shrink-0 items-center justify-center sm:h-48 sm:w-1/2">
        <img src={game.art} alt="" className="max-h-full max-w-full object-contain" />
      </div>

      <div className="sm:w-1/2">
        <h3 className="font-display text-xl font-bold text-home-ink">{game.title}</h3>
        <p className="mt-2 text-sm leading-snug text-home-ink/80">{game.description}</p>

        <span className="mt-5 inline-flex items-center justify-center rounded-full bg-home-play px-8 py-3 font-display text-base font-bold tracking-wide text-white transition-transform group-hover:scale-[1.03]">
          PLAY NOW
        </span>
      </div>
    </a>
  );
}

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [playableOnly, setPlayableOnly] = useState(false);
  // null = any party size; otherwise show only games that seat exactly N.
  const [playerCount, setPlayerCount] = useState<number | null>(null);

  const searching = query.trim().length > 0;
  const filtering = searching || playableOnly || playerCount !== null;

  const fitsPlayerCount = (game: Game) =>
    playerCount === null || (game.minPlayers <= playerCount && playerCount <= game.maxPlayers);

  // The spotlight is a "what's new" shelf, so it steps aside once the user is
  // actively filtering — per the note in the mockup.
  const newest = GAMES.find((game) => game.newest && game.href);
  const showSpotlight = !filtering && newest;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GAMES.filter((game) => {
      // Don't repeat the spotlit game directly underneath itself.
      if (showSpotlight && game.id === newest?.id) return false;
      if (playableOnly && !game.href) return false;
      if (!fitsPlayerCount(game)) return false;
      if (!q) return true;
      return (
        game.title.toLowerCase().includes(q) || game.description.toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, playableOnly, playerCount, showSpotlight, newest]);

  return (
    <div className="min-h-screen bg-white font-sans text-home-ink">
      <header className="rounded-b-[2rem] bg-home-cyan px-4 pb-6 pt-8 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {searching && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white transition-transform hover:scale-105"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-home-ink/60"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              aria-label="Search games"
              className="h-12 w-full rounded-full bg-white pl-12 pr-4 text-base placeholder:text-home-ink/50 focus:outline-none focus:ring-2 focus:ring-home-ink/20"
            />
          </div>

          <button
            type="button"
            onClick={() => setPlayableOnly((on) => !on)}
            aria-pressed={playableOnly}
            aria-label="Show only games that are playable now"
            title="Show only games that are playable now"
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105',
              playableOnly ? 'bg-home-ink text-white' : 'bg-white text-home-ink'
            )}
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </div>

        {/* Player-count filter + the join shortcut. The Join link isn't in the
            mockup, but the homepage is the only route into #/join. */}
        <div className="mx-auto mt-3 flex max-w-3xl items-center justify-between gap-3">
          <div className="relative">
            <Users
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-home-ink/60"
              aria-hidden="true"
            />
            <select
              value={playerCount ?? ''}
              onChange={(e) => setPlayerCount(e.target.value ? Number(e.target.value) : null)}
              aria-label="Filter by player count"
              className="h-10 appearance-none rounded-full bg-white pl-9 pr-9 text-sm font-semibold text-home-ink focus:outline-none focus:ring-2 focus:ring-home-ink/20"
            >
              <option value="">Any players</option>
              {Array.from({ length: MAX_PLAYERS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'player' : 'players'}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-home-ink/60"
              aria-hidden="true"
            />
          </div>

          <a
            href="#/join"
            className="rounded-full bg-white/70 px-4 py-1.5 text-sm font-bold text-home-ink transition-colors hover:bg-white"
          >
            Join a game →
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        {showSpotlight && (
          <section className="pt-8">
            <h2 className="mb-4 font-display text-2xl font-extrabold">Newest</h2>
            <Spotlight game={newest} />
          </section>
        )}

        <section className="pt-8">
          <h2 className="mb-4 font-display text-2xl font-extrabold">
            {filtering ? 'Results' : 'More Games'}
          </h2>

          {results.length === 0 ? (
            <p className="text-sm text-home-ink/60">
              {playerCount !== null && !searching
                ? `No games seat ${playerCount} ${playerCount === 1 ? 'player' : 'players'}.`
                : `No games match “${query}”.`}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-5">
              {results.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
