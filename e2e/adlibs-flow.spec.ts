import { test, expect, type Browser, type Page } from '@playwright/test';

test.setTimeout(180_000);

test('host + 2 players play a full round of Memo-Random', async ({ browser }: { browser: Browser }) => {
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
  const code = await host.locator('span.font-display.text-2xl').innerText();
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

  // Type a handful of valid, taggable words on each client. Pronouns are
  // never typed at all — round 2 randomizes a player name for those blanks
  // instead — so these are all noun/verb/adjective words.
  const wordSets = [
    ['dog', 'run', 'happy', 'blue'],
    ['cat', 'jump', 'quiet', 'silly'],
    ['fox', 'walk', 'big', 'shiny'],
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

  // Wait out the round-1 timer for it to auto-submit on every client, then
  // land on round 2. Deliberately not asserting on the intermediate
  // "Waiting for other players" text in between: with round durations
  // shortened for local testing (see .env), the fast "everyone's submitted"
  // path can make that state transient enough for a dedicated wait on it to
  // race past unseen, especially checking host/p1/p2 sequentially. Round 2
  // sheet should appear on each client UNLESS ntfy's best-effort delivery
  // dropped that specific player's round-1 submission before the host's
  // grace-period deadline — in which case they correctly see the "sat out
  // this round" fallback screen instead. Both are valid outcomes; the game
  // must never hang for anyone either way.
  const reachedRound2: Page[] = [];
  for (const page of [host, p1, p2]) {
    const sheetVisible = page.getByText('Fill out your memo');
    const droppedVisible = page.getByText('sat out round 2');
    await expect(sheetVisible.or(droppedVisible)).toBeVisible({ timeout: 90_000 });
    if (await sheetVisible.isVisible()) reachedRound2.push(page);
  }
  expect(reachedRound2.length).toBeGreaterThan(0);

  // Fill every dropdown with its first real option, then submit, on each
  // client that made it to round 2 — this should advance to results as soon
  // as everyone has submitted, without waiting out the full round-2 timer.
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
    await page.getByRole('button', { name: 'Submit' }).click();
  }

  // Sequential head-to-head matchups: everyone who's allowed to vote votes
  // for the left memo and hits Submit, so each match resolves as soon as the
  // last vote comes in — well before the 20s vote timer would otherwise
  // force it. Bracket size and pairing (including any bot opponent for an
  // odd sheet out) are randomized and depend on how many players actually
  // reached round 2, so this loops until the final scoreboard appears
  // rather than assuming a fixed number of matches. Whoever authored one of
  // the two memos in a given matchup can't vote in it at all (not even for
  // the other side) — their screen shows "Wait for Others to Vote" instead
  // of "Pick the Better One", with no vote buttons — so which of the three
  // clients can actually vote varies matchup to matchup.
  for (let round = 0; round < 5; round++) {
    await expect(
      host.getByText('Pick the Better One').or(host.getByText('Wait for Others to Vote')).or(host.getByText('Final Scoreboard'))
    ).toBeVisible({ timeout: 20_000 });
    if (await host.getByText('Final Scoreboard').isVisible()) break;

    for (const page of [host, p1, p2]) {
      await expect(
        page.getByText('Pick the Better One').or(page.getByText('Wait for Others to Vote'))
      ).toBeVisible({ timeout: 20_000 });
      if (await page.getByText('Pick the Better One').isVisible()) {
        // Your own memo (if it's one of the two) isn't a clickable button —
        // it's a disabled card with a "wait for others to vote" overlay —
        // so scope to actual buttons rather than blindly picking the first
        // card.
        await page.getByRole('button').filter({ hasText: 'Inter-Office Memo' }).first().click();
        await page.getByRole('button', { name: 'Submit' }).click();
      }
    }

    for (const page of [host, p1, p2]) {
      await expect(page.getByText(/And the Winner Is|It's a Tie!/)).toBeVisible({ timeout: 20_000 });
    }
  }

  for (const page of [host, p1, p2]) {
    await expect(page.getByText('Final Scoreboard')).toBeVisible({ timeout: 20_000 });
  }

  // Host gets game-management controls; everyone else can only disconnect.
  await expect(host.getByRole('button', { name: 'Play Again' })).toBeVisible();
  await expect(host.getByRole('button', { name: 'End Session' })).toBeVisible();
  for (const page of [p1, p2]) {
    await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible();
  }

  // Play Again should take everyone back to the same lobby (same room code,
  // roster intact) rather than spinning up a brand new room.
  await host.getByRole('button', { name: 'Play Again' }).click();
  for (const page of [host, p1, p2]) {
    await expect(page.getByText(code)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Hosty')).toBeVisible();
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('Bob')).toBeVisible();
  }

  await hostCtx.close();
  await p1Ctx.close();
  await p2Ctx.close();
});
