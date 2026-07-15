import { test, expect, type Browser } from '@playwright/test';

test.setTimeout(180_000);

// Joke Factory needs 3 players. Drives host + 2 players from round 1 through round 3
// and final leaderboard using UI controls and debug widget actions.
test('host + 2 players step through Joke Factory rounds and verify leaderboard', async ({ browser }: { browser: Browser }) => {
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const [host, p1, p2] = await Promise.all(contexts.map((c) => c.newPage()));

  // 1. Host creates room
  await host.goto('/#/host?game=joke-factory');
  await host.getByPlaceholder('Your name...').fill('Hosty');
  await host.getByRole('button', { name: 'Create Room' }).click();
  const code = await host.locator('span.font-display.text-2xl').innerText();
  expect(code).toMatch(/^[A-Z]{4}$/);

  // 2. Clients join room
  for (const [page, name] of [[p1, 'Alice'], [p2, 'Bob']] as const) {
    await page.goto(`/#/join?code=${code}`);
    await page.getByPlaceholder('Enter your name...').fill(name);
    await page.getByRole('button', { name: 'Join Game Room' }).click();
  }
  await expect(host.getByText('Bob')).toBeVisible({ timeout: 15_000 });

  // 3. Start Game
  await host.getByRole('button', { name: 'Start Game' }).click();

  // 4. Play Round 1
  await expect(host.getByText('Prepare', { exact: false }).or(host.getByText('Get ready', { exact: false }))).toBeVisible({ timeout: 15_000 });
  await expect(host.getByText('Round 1: Write!')).toBeVisible({ timeout: 15_000 });
  
  // Skip writing using debug widget
  await host.getByRole('button', { name: 'Skip Writing Phase' }).click();

  // Transition through Round 1 matchups (N=3 players = 3 matchups)
  for (let m = 0; m < 3; m++) {
    await expect(host.getByText('Battle', { exact: false })).toBeVisible({ timeout: 15_000 });
    await host.getByRole('button', { name: 'Skip Matchup' }).click();

    await expect(host.getByText('Battle Results')).toBeVisible({ timeout: 15_000 });
    await host.getByRole('button', { name: 'Skip Results Display' }).click();
  }

  // Standings / Leaderboard at end of Round 1
  await expect(host.getByText('Round 1 Standings')).toBeVisible({ timeout: 15_000 });
  await host.getByRole('button', { name: 'Start Round 2' }).click();

  // 5. Play Round 2
  await expect(host.getByText('Round 2: Write!')).toBeVisible({ timeout: 15_000 });
  await host.getByRole('button', { name: 'Skip Writing Phase' }).click();

  // Transition through Round 2 matchups (3 matchups)
  for (let m = 0; m < 3; m++) {
    await expect(host.getByText('Battle', { exact: false })).toBeVisible({ timeout: 15_000 });
    await host.getByRole('button', { name: 'Skip Matchup' }).click();

    await expect(host.getByText('Battle Results')).toBeVisible({ timeout: 15_000 });
    await host.getByRole('button', { name: 'Skip Results Display' }).click();
  }

  // Standings / Leaderboard at end of Round 2
  await expect(host.getByText('Round 2 Standings')).toBeVisible({ timeout: 15_000 });
  await host.getByRole('button', { name: 'Start Round 3' }).click();

  // 6. Play Round 3 (Double Points!)
  await expect(host.getByText('Round 3: Write!')).toBeVisible({ timeout: 15_000 });
  await host.getByRole('button', { name: 'Skip Writing Phase' }).click();

  // Round 3 has only 1 matchup (all answers voted together)
  await expect(host.getByText('The Final Battle!')).toBeVisible({ timeout: 15_000 });
  await host.getByRole('button', { name: 'Skip Matchup' }).click();

  await expect(host.getByText('Battle Results')).toBeVisible({ timeout: 15_000 });
  await host.getByRole('button', { name: 'Skip Results Display' }).click();

  // 7. Final Scoreboard
  await expect(host.getByText('Final Scoreboard')).toBeVisible({ timeout: 15_000 });
  await host.getByRole('button', { name: 'End Game' }).click();

  // Close contexts
  await Promise.all(contexts.map((c) => c.close()));
});
