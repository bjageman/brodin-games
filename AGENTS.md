# Agent guidelines

## File size

Keep source files **at most 600 lines, preferably under 500.**

When a file approaches the limit, split it rather than letting it grow:

- **Per-game screens** → extract the render into a `components/<Game>Views.tsx`
  (see `src/apps/fake-it/components/FakeItViews.tsx`,
  `src/apps/bomb-disarm/components/BombViews.tsx`).
- **Dev-only debug controls** → extract into a `use<Game>Debug` hook
  (see `src/apps/fake-it/useFakeItDebug.ts`,
  `src/apps/memo-random/useMemoRandomDebug.ts`).
- **Host game logic** → extract into a `use<Game>Host` hook that owns the
  host-only bookkeeping refs and returns them plus its handlers
  (see `src/apps/memo-random/useMemoRandomHost.ts`).

Prefer moving code verbatim and wiring dependencies through a typed context
object so TypeScript verifies the split. Pull genuinely shared UI into
`src/shared/components/` (e.g. `WaitingForHost.tsx`).
