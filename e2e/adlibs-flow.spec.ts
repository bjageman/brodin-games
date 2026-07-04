import { test, expect, type Browser, type Page } from '@playwright/test';

test.setTimeout(180_000);

test('host + 2 players play a full round of Ad-libs Race', async ({ browser }: { browser: Browser }) => {
  const hostCtx = await browser.newContext();
  const p1Ctx = await browser.newContext();
  const p2Ctx = await browser.newContext();

  const host = await hostCtx.newPage();
  const p1 = await p1Ctx.newPage();
  const p2 = await p2Ctx.newPage();

  // Host creates a room.
  await host.goto('/#/host');
  await host.getByPlaceholder('Your name...').fill('Hosty');
  await host.getByRole('button', { name: 'Create Room' }).click();
  const code = await host.locator('button.font-mono').innerText();
  expect(code).toMatch(/^[A-Z]{4}$/);

  // Both players join with the code.
  for (const [page, name] of [[p1, 'Alice'], [p2, 'Bob']] as const) {
    await page.goto(`/#/join?code=${code}`);
    await page.getByPlaceholder('Enter your name...').fill(name);
    await page.getByRole('button', { name: 'Join Game Room' }).click();
  }

  // Roster should show both players on the host screen.
  await expect(host.getByText('Alice')).toBeVisible({ timeout: 15_000 });
  await expect(host.getByText('Bob')).toBeVisible({ timeout: 15_000 });

  // Host starts the game.
  await host.getByRole('button', { name: 'Start Game' }).click();

  // All three (host plays too) should now be in round 1.
  for (const page of [host, p1, p2]) {
    await expect(page.getByText('Type as many words as you can')).toBeVisible({ timeout: 10_000 });
  }

  // Type a handful of valid, taggable words on each client.
  const wordSets = [
    ['dog', 'run', 'happy', 'she'],
    ['cat', 'jump', 'blue', 'they'],
    ['fox', 'walk', 'big', 'he'],
  ];
  for (const [page, words] of [[host, wordSets[0]], [p1, wordSets[1]], [p2, wordSets[2]]] as const) {
    const input = page.getByPlaceholder('Type a word...');
    for (const word of words) {
      await input.fill(word);
      await input.press('Enter');
    }
    for (const word of words) {
      await expect(page.getByText(word, { exact: true })).toBeVisible();
    }
  }

  // Wait out the round-1 timer (60s) for it to auto-submit on every client.
  for (const page of [host, p1, p2]) {
    await expect(page.getByText(/Waiting for other players/)).toBeVisible({ timeout: 70_000 });
  }

  // Round 2 sheet should appear on each client UNLESS ntfy's best-effort
  // delivery dropped that specific player's round-1 submission before the
  // host's grace-period deadline — in which case they correctly see the
  // "sat out this round" fallback screen instead. Both are valid outcomes;
  // the game must never hang for anyone either way.
  const reachedRound2: Page[] = [];
  for (const page of [host, p1, p2]) {
    const sheetVisible = page.getByText('Fill out your ad-libs sheet');
    const droppedVisible = page.getByText('sat out round 2');
    await expect(sheetVisible.or(droppedVisible)).toBeVisible({ timeout: 20_000 });
    if (await sheetVisible.isVisible()) reachedRound2.push(page);
  }
  expect(reachedRound2.length).toBeGreaterThan(0);

  // Fill every dropdown with its first real option on each client that made it to round 2.
  for (const page of reachedRound2) {
    const selects = page.locator('select');
    const count = await selects.count();
    for (let i = 0; i < count; i++) {
      const select = selects.nth(i);
      const options = await select.locator('option').all();
      const values = await Promise.all(options.map((o) => o.getAttribute('value')));
      const firstReal = values.find((v) => v);
      if (firstReal) await select.selectOption(firstReal);
    }
  }

  // Wait out the round-2 timer (60s) for auto-submit, then check results.
  for (const page of [host, p1, p2]) {
    await expect(page.getByText("Everyone's Ad-libs")).toBeVisible({ timeout: 70_000 });
  }

  // Every client's results screen should list every player who reached round 2.
  const namesByPage = new Map([[host, 'Hosty'], [p1, 'Alice'], [p2, 'Bob']]);
  const expectedNames = reachedRound2.map((page) => namesByPage.get(page)!);
  for (const page of [host, p1, p2]) {
    for (const expectedName of expectedNames) {
      await expect(page.getByText(expectedName)).toBeVisible();
    }
  }

  await hostCtx.close();
  await p1Ctx.close();
  await p2Ctx.close();
});
