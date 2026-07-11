import { test, expect, type Browser } from '@playwright/test';

test.setTimeout(180_000);

// Drives Fake It through every phase screen (role reveal → drawing → voting →
// results → leaderboard) using the debug widget to skip timers, with three real
// browser contexts over ntfy. Guards the FakeItScreens / useFakeItDebug split.
test('host + 2 players step through every Fake It screen', async ({ browser }: { browser: Browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const [host, p1, p2] = await Promise.all(contexts.map((c) => c.newPage()));

  await host.goto('/#/host?game=fake-it');
  await host.getByPlaceholder('Your name...').fill('Hosty');
  await host.getByRole('button', { name: 'Create Room' }).click();
  const code = await host.locator('span.font-display.text-2xl').innerText();
  expect(code).toMatch(/^[A-Z]{4}$/);

  for (const [page, name] of [[p1, 'Alice'], [p2, 'Bob']] as const) {
    await page.goto(`/#/join?code=${code}`);
    await page.getByPlaceholder('Enter your name...').fill(name);
    await page.getByRole('button', { name: 'Join Game Room' }).click();
  }
  await expect(host.getByText('Alice')).toBeVisible({ timeout: 15_000 });
  await expect(host.getByText('Bob')).toBeVisible({ timeout: 15_000 });

  await host.getByRole('button', { name: 'Start Game' }).click();

  // Role reveal
  for (const page of [host, p1, p2]) {
    await expect(page.getByRole('heading', { name: 'Prepare to Draw' })).toBeVisible({ timeout: 15_000 });
  }
  await host.getByRole('button', { name: 'Skip Reveal' }).click();

  // Drawing
  for (const page of [host, p1, p2]) {
    await expect(page.getByText(/Drawing Round/)).toBeVisible({ timeout: 15_000 });
  }
  await host.getByRole('button', { name: 'Skip All Drawing Turns' }).click();

  // Voting
  for (const page of [host, p1, p2]) {
    await expect(page.getByText('Who is the Imposter?')).toBeVisible({ timeout: 15_000 });
  }
  await host.getByRole('button', { name: 'Skip Voting' }).click();

  // Results
  for (const page of [host, p1, p2]) {
    await expect(page.getByText('Imposter Revealed!')).toBeVisible({ timeout: 15_000 });
  }
  await host.getByRole('button', { name: 'View Final Leaderboard' }).click();

  // Leaderboard (this control transitions the host's own view only).
  await expect(host.getByRole('heading', { name: 'Leaderboard' })).toBeVisible({ timeout: 15_000 });

  await Promise.all(contexts.map((c) => c.close()));
});
