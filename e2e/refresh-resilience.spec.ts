import { test, expect, type Browser } from '@playwright/test';

test.setTimeout(120_000);

test('refreshing the host or a player mid-game resumes instead of losing state', async ({ browser }: { browser: Browser }) => {
  const hostCtx = await browser.newContext();
  const p1Ctx = await browser.newContext();

  const host = await hostCtx.newPage();
  const p1 = await p1Ctx.newPage();

  await host.goto('/#/host');
  await host.getByPlaceholder('Your name...').fill('Hosty');
  await host.getByRole('button', { name: 'Create Room' }).click();
  const code = await host.locator('span.font-display.text-2xl').innerText();

  await p1.goto(`/#/join?code=${code}`);
  await p1.getByPlaceholder('Enter your name...').fill('Alice');
  await p1.getByRole('button', { name: 'Join Game Room' }).click();

  await expect(host.getByText('Alice')).toBeVisible({ timeout: 15_000 });

  // Host refreshes while still in the lobby: same room code, same roster,
  // still showing the lobby (not dropped back to the name-entry form or a
  // freshly-generated new code).
  await host.reload();
  await expect(host.getByText('Enter Your Name')).not.toBeVisible();
  const codeAfterReload = await host.locator('span.font-display.text-2xl').innerText();
  expect(codeAfterReload).toBe(code);
  await expect(host.getByText('Alice')).toBeVisible({ timeout: 10_000 });
  // "Start Game" is disabled until the WebSocket reconnects after reload (so
  // the host's own click doesn't get lost waiting on its own echoed
  // broadcast) — click() auto-waits for it to become enabled.
  await expect(host.getByRole('button', { name: 'Start Game' })).toBeEnabled({ timeout: 10_000 });
  await host.getByRole('button', { name: 'Start Game' }).click();
  await expect(host.getByText('Type as many words as you can')).toBeVisible({ timeout: 10_000 });
  await expect(p1.getByText('Type as many words as you can')).toBeVisible({ timeout: 10_000 });

  // Player refreshes mid-round1: should resume directly into round1 (not
  // the join form), still in the same room, still recognized by the host.
  await p1.reload();
  await expect(p1.getByText('Enter Game Room')).not.toBeVisible();
  await expect(p1.getByText('Type as many words as you can')).toBeVisible({ timeout: 10_000 });

  // Host also refreshes mid-round1: the game must still be running (same
  // phase), not reset to a fresh empty lobby.
  await host.reload();
  await expect(host.getByText('Type as many words as you can')).toBeVisible({ timeout: 10_000 });

  await hostCtx.close();
  await p1Ctx.close();
});
