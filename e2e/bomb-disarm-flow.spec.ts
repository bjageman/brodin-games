import { test, expect, type Browser } from '@playwright/test';

test.setTimeout(180_000);

// Drives a full Bomb Disarm game with three real browser contexts talking over
// the live ntfy broker, using the debug widget to skip the 60s memorize timer
// and to force a deterministic Peacekeeper win (revealing all 6 cut wires).
test('host + 2 players play a full Bomb Disarm game (peacekeepers disarm)', async ({ browser }: { browser: Browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const [host, p1, p2] = await Promise.all(contexts.map((c) => c.newPage()));

  // Host opens a Bomb Disarm room.
  await host.goto('/#/host?game=bomb-disarm');
  await host.getByPlaceholder('Your name...').fill('Hosty');
  await host.getByRole('button', { name: 'Create Room' }).click();
  const code = await host.locator('span.font-display.text-2xl').innerText();
  expect(code).toMatch(/^[A-Z]{4}$/);

  // Two players join → 3 players total (the minimum).
  for (const [page, name] of [[p1, 'Alice'], [p2, 'Bob']] as const) {
    await page.goto(`/#/join?code=${code}`);
    await page.getByPlaceholder('Enter your name...').fill(name);
    await page.getByRole('button', { name: 'Join Game Room' }).click();
  }
  await expect(host.getByText('Alice')).toBeVisible({ timeout: 15_000 });
  await expect(host.getByText('Bob')).toBeVisible({ timeout: 15_000 });

  // Start → everyone sees their team.
  await host.getByRole('button', { name: 'Start Game' }).click();
  for (const page of [host, p1, p2]) {
    await expect(page.getByRole('heading', { name: 'Your Team' })).toBeVisible({ timeout: 15_000 });
  }

  // Skip the role countdown → memorize phase reaches every client.
  await host.getByRole('button', { name: 'Skip to Memorize' }).click();
  for (const page of [host, p1, p2]) {
    await expect(page.getByText('Memorize your hand')).toBeVisible({ timeout: 15_000 });
  }

  // Skip the 60s memorize timer → table phase, cards face-down.
  await host.getByRole('button', { name: 'Skip to Table' }).click();
  for (const page of [host, p1, p2]) {
    await expect(page.getByText(/\d\/6 wires/)).toBeVisible({ timeout: 15_000 });
  }

  // Turn gating: every client shows either the "your turn" or the "someone else
  // is choosing" banner (exactly one player is active at a time).
  for (const page of [host, p1, p2]) {
    await expect(page.getByText('Your turn').or(page.getByText('is choosing'))).toBeVisible({ timeout: 15_000 });
  }

  // Force a Peacekeeper win by cutting all 6 wires. Wait for each cut to register
  // (serializing the debug reveals) before triggering the next.
  for (let i = 1; i <= 6; i++) {
    const btn = host.getByRole('button', { name: 'Reveal a Cut Wire' });
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await btn.click();
    if (i < 6) {
      await expect(host.getByText(new RegExp(`${i}/6 wires`))).toBeVisible({ timeout: 10_000 });
    }
  }

  // Peacekeepers win on every screen, and roles are revealed.
  for (const page of [host, p1, p2]) {
    await expect(page.getByRole('heading', { name: 'Peacekeepers Win' })).toBeVisible({ timeout: 15_000 });
  }
  await expect(host.getByText('Roles Revealed')).toBeVisible();

  // Play Again returns everyone to the same lobby with the roster intact.
  await host.getByRole('button', { name: 'Play Again' }).click();
  for (const page of [host, p1, p2]) {
    await expect(page.getByText(code)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Hosty')).toBeVisible();
  }

  await Promise.all(contexts.map((c) => c.close()));
});
