import { test, expect, type Browser } from '@playwright/test';

test.setTimeout(180_000);

// Memo-Random needs 4 players. Drives host + 3 players from round 1 into round 2
// and through matchups to the final leaderboard using the debug widget's simulate + skip controls.
// Exercises beginRound1 → round1-start → word-library handling → advanceToRound2 →
// library assignment → matchup screen → matchup results → winner screen.
test('host + 3 players step through every Memo-Random screen and verify scoreboard', async ({ browser }: { browser: Browser }) => {
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

  // Round 1
  await expect(host.getByText('Type as many words as you can')).toBeVisible({ timeout: 15_000 });
  await host.getByRole('button', { name: 'Simulate Words for Others' }).click();
  await host.getByRole('button', { name: 'Skip to Round 2' }).click();

  // Round 2
  await expect(
    host.getByText('Fill out your memo').or(host.getByText('sat out round 2'))
  ).toBeVisible({ timeout: 20_000 });

  await host.getByRole('button', { name: 'Simulate Sheets for Others' }).click();
  await host.getByRole('button', { name: 'Skip to Matchups' }).click();

  // Matchups and Results loop
  let iterations = 0;
  while (iterations < 20) {
    const isWinner = await host.getByText('Final Scoreboard').isVisible();
    if (isWinner) {
      break;
    }

    const isMatchup = await host.getByText('VS').isVisible();
    if (isMatchup) {
      await host.getByRole('button', { name: 'Skip Matchup' }).click();
      await host.waitForTimeout(500);
      continue;
    }

    const isResults = await host.getByText('Winner Is').or(host.getByText('Tie')).or(host.getByText('Winner!')).isVisible();
    if (isResults) {
      await host.getByRole('button', { name: 'Skip Results Display' }).click();
      await host.waitForTimeout(500);
      continue;
    }

    await host.waitForTimeout(500);
    iterations++;
  }

  // Leaderboard
  await expect(host.getByText('Final Scoreboard')).toBeVisible({ timeout: 15_000 });

  await Promise.all(contexts.map((c) => c.close()));
});
