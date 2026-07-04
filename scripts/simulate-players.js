#!/usr/bin/env node
// Manual-testing helper: spins up N headless/headed browser dummy players
// that join a real room code (from a game you're hosting yourself in an
// actual browser) and play through with randomized input, so you don't have
// to manually operate every player during a manual pass through the app.
//
// Usage:
//   npm run simulate -- --code=ABCD --players=3
//   npm run simulate -- --code=ABCD --players=1 --headless --url=http://localhost:5173
//
// Run this AFTER you've created a room as host and are still in the lobby —
// the bots just join like any other player and wait for you to hit "Start
// Game" from your own browser.

import { chromium, expect } from '@playwright/test';

function parseArgs(argv) {
  const args = { players: 1, url: 'http://localhost:5173', headless: true, code: null };
  for (const arg of argv) {
    const stripped = arg.replace(/^--/, '');
    const eq = stripped.indexOf('=');
    const key = eq === -1 ? stripped : stripped.slice(0, eq);
    const value = eq === -1 ? 'true' : stripped.slice(eq + 1);
    if (key === 'players') args.players = parseInt(value, 10);
    else if (key === 'code') args.code = value.toUpperCase();
    else if (key === 'url') args.url = value.replace(/\/$/, '');
    else if (key === 'headless') args.headless = value !== 'false';
    else if (key === 'headed') args.headless = false;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.code || args.code.length !== 4 || !Number.isInteger(args.players) || args.players < 1) {
  console.error('Usage: npm run simulate -- --code=ABCD [--players=3] [--url=http://localhost:5173] [--headed]');
  process.exit(1);
}

const NOUNS = ['dog', 'cat', 'fox', 'house', 'tree', 'car', 'book', 'chair', 'apple', 'river', 'mountain', 'robot', 'pizza', 'guitar', 'bicycle'];
const VERBS = ['run', 'jump', 'walk', 'sing', 'dance', 'laugh', 'swim', 'climb', 'cook', 'paint', 'sleep', 'shout'];
const ADJECTIVES = ['happy', 'blue', 'big', 'tiny', 'loud', 'quiet', 'shiny', 'fast', 'slow', 'brave', 'silly', 'ancient'];
const PRONOUNS = ['she', 'he', 'they', 'we', 'it', 'you'];
const WORD_POOL = [...NOUNS, ...VERBS, ...ADJECTIVES, ...PRONOUNS];

const BOT_NAMES = ['Bilbo', 'Frodo', 'Gandalf', 'Aragorn', 'Legolas', 'Gimli', 'Boromir', 'Samwise', 'Merry', 'Pippin', 'Galadriel', 'Elrond'];

function shuffled(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomDelay(minMs, maxMs) {
  return new Promise((resolve) => setTimeout(resolve, minMs + Math.random() * (maxMs - minMs)));
}

async function waitVisible(locator, timeout) {
  return locator.waitFor({ timeout }).then(() => true).catch(() => false);
}

async function runBot(browser, index, code, url) {
  const name = index < BOT_NAMES.length ? BOT_NAMES[index] : `Bot${index}`;
  const log = (msg) => console.log(`[${name}] ${msg}`);

  // Isolate failures per bot — one bot erroring shouldn't cut short the
  // whole batch or the console log for the others (they keep running
  // independently either way, since each is its own async task).
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${url}/#/join?code=${code}`);
    await page.getByPlaceholder('Enter your name...').fill(name);
    await page.getByRole('button', { name: 'Join Game Room' }).click();
    log('joined lobby, waiting for host to start...');

    // Round 1 (only if we're still around for it — a bot started this late
    // could join mid-round or skip straight to waiting for round 2).
    if (await waitVisible(page.getByText('Type as many words as you can'), 5 * 60_000)) {
      const myWords = shuffled(WORD_POOL).slice(0, 4 + Math.floor(Math.random() * 4));
      const input = page.getByPlaceholder('Type a word...');
      for (const word of myWords) {
        await input.fill(word);
        await input.press('Enter');
        await randomDelay(300, 1500);
      }
      log(`typed ${myWords.length} words: ${myWords.join(', ')}`);
    }

    const sheetOrDropped = page.getByText('Fill out your ad-libs sheet').or(page.getByText('sat out round 2'));
    await sheetOrDropped.waitFor({ timeout: 90_000 });

    if (await page.getByText('sat out round 2').isVisible()) {
      log('sat out round 2 (submission arrived too late)');
    } else {
      const selects = page.locator('select');
      const count = await selects.count();
      for (let i = 0; i < count; i++) {
        const select = selects.nth(i);
        const values = await Promise.all((await select.locator('option').all()).map((o) => o.getAttribute('value')));
        const real = values.filter((v) => v);
        if (real.length > 0) {
          await select.selectOption(real[Math.floor(Math.random() * real.length)]);
        }
      }
      await randomDelay(500, 3000);
      // Filling the last dropdown triggers a React re-render before the
      // Submit button flips to enabled — wait/retry for it rather than
      // checking once and silently giving up if we're too early.
      const submitButton = page.getByRole('button', { name: 'Submit' });
      await expect(submitButton).toBeEnabled({ timeout: 10_000 });
      await submitButton.click();
      log('submitted round 2 sheet');
    }

    if (await waitVisible(page.getByText('Select Your Favorite'), 90_000)) {
      await randomDelay(500, 3000);
      // The voting screen now also has its own "Submit" button once a card
      // is picked — scope the random pick to the vote cards only, so we
      // never accidentally target the (disabled-until-selected) Submit
      // button itself.
      const voteCards = page.getByRole('button').filter({ hasNotText: 'Submit' });
      const voteCount = await voteCards.count();
      if (voteCount > 0) {
        await voteCards.nth(Math.floor(Math.random() * voteCount)).click();
        log('voted');
        await randomDelay(300, 2000);
        const submitVoteButton = page.getByRole('button', { name: 'Submit' });
        await expect(submitVoteButton).toBeEnabled({ timeout: 5_000 });
        await submitVoteButton.click();
        log('submitted vote');
      }
    }

    await waitVisible(page.getByText(/Winner!|It's a Tie!|No Votes Cast/), 90_000);
    log('reached the winner screen — leaving this browser open for inspection.');
  } catch (err) {
    log(`stopped early due to an error: ${String(err.message || err).split('\n')[0]}`);
  }
}

const browser = await chromium.launch({ headless: args.headless });
console.log(`Spawning ${args.players} bot(s) into room ${args.code} at ${args.url}...\n`);

await Promise.all(Array.from({ length: args.players }, (_, i) => runBot(browser, i, args.code, args.url)));

console.log('\nAll bots finished their run. Press Ctrl+C to close the browsers.');
process.stdin.resume();
process.on('SIGINT', async () => {
  await browser.close();
  process.exit(0);
});
