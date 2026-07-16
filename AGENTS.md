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

## Git and Pull Requests

Use the custom push script to push branches, check for merge conflicts, enable auto-merge, and monitor CI checks:
* Script: [/home/neurobomber/.gemini/antigravity-cli/scratch/push-and-check.sh](file:///home/neurobomber/.gemini/antigravity-cli/scratch/push-and-check.sh) (symlinked to [push-and-check.sh](file:///home/neurobomber/.claude/skills/github/push-and-check.sh))

Usage:
* Push and watch: `/home/neurobomber/.gemini/antigravity-cli/scratch/push-and-check.sh`
* Create PR and watch: `/home/neurobomber/.gemini/antigravity-cli/scratch/push-and-check.sh --create`
* Enable squash auto-merge: `/home/neurobomber/.gemini/antigravity-cli/scratch/push-and-check.sh --auto-merge`

