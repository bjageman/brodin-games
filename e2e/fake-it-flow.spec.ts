import { test, expect, type Browser } from '@playwright/test';

test.setTimeout(180_000);

// Drives Fake It through every phase screen (role reveal → drawing → voting →
// guessing → results → leaderboard) using the debug widget to skip timers, with three real
// browser contexts over ntfy. Guards the FakeItScreens / useFakeItDebug split and gameplay correctness.
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

  // Let player 1 draw an avatar
  await p1.getByRole('button', { name: 'Draw Custom Avatar' }).click();
  await p1.getByRole('button', { name: 'Save' }).click();

  await host.getByRole('button', { name: 'Start Game' }).click();

  // Role reveal
  for (const page of [host, p1, p2]) {
    await expect(page.getByRole('heading', { name: 'Prepare to Draw' }).or(page.getByRole('heading', { name: 'You are the Imposter' }))).toBeVisible({ timeout: 15_000 });
  }

  // Find who the imposter is and get the topic name
  let imposterPage = host;
  let imposterName = 'Hosty';
  let artistPages = [p1, p2];

  const hostHeading = await host.getByRole('heading').innerText();
  if (hostHeading.includes('Imposter')) {
    imposterPage = host;
    imposterName = 'Hosty';
    artistPages = [p1, p2];
  } else {
    const p1Heading = await p1.getByRole('heading').innerText();
    if (p1Heading.includes('Imposter')) {
      imposterPage = p1;
      imposterName = 'Alice';
      artistPages = [host, p2];
    } else {
      imposterPage = p2;
      imposterName = 'Bob';
      artistPages = [host, p1];
    }
  }

  const topicName = await artistPages[0].locator('.bg-fakeit-panel p.font-serifDisplay.text-4xl').innerText();

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

  // Everyone votes - artists vote imposter, imposter votes one of the artists
  for (const artist of artistPages) {
    await artist.getByRole('button', { name: imposterName.toUpperCase() }).click();
  }
  const targetName = artistPages[0] === host ? 'Hosty' : 'Alice';
  await imposterPage.getByRole('button', { name: targetName.toUpperCase() }).click();

  // Guessing phase
  for (const artist of artistPages) {
    await expect(artist.getByText('The Imposter is guessing...')).toBeVisible({ timeout: 15_000 });
  }
  await expect(imposterPage.getByText("You've been caught!")).toBeVisible({ timeout: 15_000 });

  // Imposter guesses correctly
  await imposterPage.getByPlaceholder('Enter the word...').fill(topicName);
  await imposterPage.getByRole('button', { name: 'Submit' }).click();

  // Results
  for (const page of [host, p1, p2]) {
    await expect(page.getByText('they got away!')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('$750')).toBeVisible({ timeout: 15_000 });
  }

  await host.getByRole('button', { name: 'View Final Leaderboard' }).click();

  // Leaderboard (this control transitions the host's own view only).
  await expect(host.getByRole('heading', { name: 'Leaderboard' })).toBeVisible({ timeout: 15_000 });

  await Promise.all(contexts.map((c) => c.close()));
});
