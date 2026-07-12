import { test, expect, type Browser } from '@playwright/test';

test.setTimeout(180_000);

// Memo-Random needs 4 players. Drives host + 3 players from round 1 into round 2
// via the debug widget's simulate + skip controls, asserting on the host (the
// authority, immune to ntfy dropping a broadcast for an individual client under
// 4-client load). Exercises beginRound1 → round1-start → word-library handling →
// advanceToRound2 → library assignment, plus the useMemoRandomDebug hook.
test('host + 3 players advance Memo-Random from round 1 into round 2', async ({ browser }: { browser: Browser }) => {
  const contexts = await Promise.all([0, 1, 2, 3].map(() => browser.newContext()));
  const [host, p1, p2, p3] = await Promise.all(contexts.map((c) => c.newPage()));

  await host.goto('/#/host?game=memo-random');
  await host.getByPlaceholder('Your name...').fill('Hosty');
  await host.getByRole('button', { name: 'Create Room' }).click();
  const code = await host.locator('span.font-display.text-2xl').innerText();
  expect(code).toMatch(/^[A-Z]{4}$/);

  for (const [page, name] of [[p1, 'Alice'], [p2, 'Bob'], [p3, 'Charlie']] as const) {
    await page.goto(`/#/join?code=${code}`);
    await page.getByPlaceholder('Enter your name...').fill(name);
    await page.getByRole('button', { name: 'Join Game Room' }).click();
  }
  await expect(host.getByText('Charlie')).toBeVisible({ timeout: 15_000 });

  await host.getByRole('button', { name: 'Start Game' }).click();

  // Round 1 (assert on the host — it starts the game locally and always lands here).
  await expect(host.getByText('Type as many words as you can')).toBeVisible({ timeout: 15_000 });

  // Debug: fill the other players' word banks, then skip to round 2. With every
  // player's library in hand, the host assigns libraries and advances.
  await host.getByRole('button', { name: 'Simulate Words for Others' }).click();
  await host.getByRole('button', { name: 'Skip to Round 2' }).click();

  // The host advances out of round 1 into a round-2 state (it sat out the deal
  // itself since it typed no words, which is the expected "dropped" fallback).
  await expect(
    host.getByText('Fill out your memo').or(host.getByText('sat out round 2'))
  ).toBeVisible({ timeout: 20_000 });

  await Promise.all(contexts.map((c) => c.close()));
});
