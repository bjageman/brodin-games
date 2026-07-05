#!/usr/bin/env node
// Manual-testing helper: spins up N headless/headed browser dummy players
// that join a real room code and play through with randomized input, so you
// don't have to manually operate every player during a manual pass through
// the app.
//
// Usage:
//   npm run simulate -- --code=ABCD --players=3
//   npm run simulate -- --code=ABCD --players=1 --headless --url=http://localhost:5173
//   npm run simulate -- --code=ABCD --players=3 --verbose
//   npm run simulate -- --host --players=3
//
// Without --host: run this AFTER you've created a room as host and are
// still in the lobby — the bots just join like any other player and wait
// for you to hit "Start Game" from your own browser.
//
// With --host: the script also spins up its own host bot that creates the
// room, waits for the requested number of player bots to join, and clicks
// "Start Game" itself — no manual browser needed at all, and no --code
// required (the host bot generates one and the player bots join it
// automatically). Useful for a fully-automated smoke test of the whole flow.
//
// --verbose prints a running [debug] trail of what each bot is waiting on
// (useful for telling exactly which step a bot got stuck on) and, if a bot
// errors out, the full error stack plus the page URL at the time of failure
// instead of just the first line of the error message.

import { chromium, expect } from '@playwright/test';

function parseArgs(argv) {
  const args = { players: 1, url: 'http://localhost:5173', headless: true, code: null, verbose: false, host: false };
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
    else if (key === 'verbose') args.verbose = value !== 'false';
    else if (key === 'host') args.host = value !== 'false';
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const validCode = args.host || (args.code && args.code.length === 4);
if (!validCode || !Number.isInteger(args.players) || args.players < 1) {
  console.error('Usage: npm run simulate -- (--code=ABCD | --host) [--players=3] [--url=http://localhost:5173] [--headed] [--verbose]');
  process.exit(1);
}

// Pronouns aren't typed at all anymore (round 2 randomizes a player name for
// those blanks instead), so bots only ever draw from these three pools.
const WORD_POOLS = {
  noun: ['dog', 'cat', 'fox', 'house', 'tree', 'car', 'book', 'chair', 'apple', 'river', 'mountain', 'robot', 'pizza', 'guitar', 'bicycle'],
  verb: ['run', 'jump', 'walk', 'sing', 'dance', 'laugh', 'swim', 'climb', 'cook', 'paint', 'sleep', 'shout'],
  adjective: ['happy', 'blue', 'big', 'tiny', 'loud', 'quiet', 'shiny', 'fast', 'slow', 'brave', 'silly', 'ancient'],
};

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

function randomCount(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

async function waitVisible(locator, timeout) {
  return locator.waitFor({ timeout }).then(() => true).catch(() => false);
}

function reportError(name, err, page, verbose) {
  const log = (msg) => console.log(`[${name}] ${msg}`);
  if (verbose) {
    log(`stopped early due to an error:\n${err.stack || err}`);
    if (page) {
      try {
        log(`page URL at time of failure: ${page.url()}`);
      } catch {
        // Page may already be closed — nothing more to report.
      }
    }
  } else {
    log(`stopped early due to an error: ${String(err.message || err).split('\n')[0]}`);
  }
}

// Shared by every participant (regular joiners and the host bot alike) once
// they're sitting in the lobby about to play: round 1 word typing, round 2
// memo filling, and the sequence of head-to-head voting matchups.
async function playThroughGame(page, name, verbose) {
  const log = (msg) => console.log(`[${name}] ${msg}`);
  const debug = (msg) => { if (verbose) log(`[debug] ${msg}`); };

  // Round 1 (only if we're still around for it — a bot started this late
  // could join mid-round or skip straight to waiting for round 2).
  debug('waiting for round 1 screen...');
  if (await waitVisible(page.getByText('Type as many words as you can'), 5 * 60_000)) {
    // 3 to 5 words per category (matching the 5/category cap), typed in a
    // shuffled order across categories rather than one category at a time.
    const myWords = shuffled(
      Object.values(WORD_POOLS).flatMap((pool) => shuffled(pool).slice(0, randomCount(3, 5)))
    );
    const input = page.getByPlaceholder('Type a word...');
    for (const word of myWords) {
      await input.fill(word);
      await input.press('Enter');
      await randomDelay(300, 1500);
    }
    log(`typed ${myWords.length} words: ${myWords.join(', ')}`);
  } else {
    debug('round 1 screen never appeared — joined mid/after round 1');
  }

  debug('waiting for round 2 sheet (or a "sat out round 2" drop screen)...');
  const sheetOrDropped = page.getByText('Fill out your memo').or(page.getByText('sat out round 2'));
  await sheetOrDropped.waitFor({ timeout: 90_000 });

  if (await page.getByText('sat out round 2').isVisible()) {
    log('sat out round 2 (submission arrived too late)');
  } else {
    const selects = page.locator('select');
    const count = await selects.count();
    debug(`filling ${count} dropdown(s) on the round 2 memo...`);
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

  // Voting is now a sequence of head-to-head matchups (one pair of memos
  // at a time, with results shown in between) rather than a single
  // pick-your-favorite-among-everyone screen. Keep voting on whatever
  // matchup comes up until the final scoreboard appears — how many
  // matchups there are (and whether an odd sheet out gets a bot opponent)
  // is decided by the host, not something this bot needs to know.
  for (let round = 0; round < 10; round++) {
    debug(`waiting for matchup ${round + 1} (or the final scoreboard)...`);
    const matchupOrFinal = page.getByText('Pick the Better One').or(page.getByText('Final Scoreboard'));
    if (!(await waitVisible(matchupOrFinal, 90_000))) {
      debug('neither a matchup nor the final scoreboard showed up within 90s — giving up on voting');
      break;
    }
    if (await page.getByText('Final Scoreboard').isVisible()) break;

    await randomDelay(500, 3000);
    // The matchup screen has its own "Submit" button once a memo is
    // picked — scope the random pick to the two vote cards only, so we
    // never accidentally target the (disabled-until-selected) Submit
    // button itself.
    const voteCards = page.getByRole('button').filter({ hasNotText: 'Submit' });
    const voteCount = await voteCards.count();
    debug(`found ${voteCount} vote card(s) for this matchup`);
    if (voteCount > 0) {
      await voteCards.nth(Math.floor(Math.random() * voteCount)).click();
      log('voted');
      await randomDelay(300, 2000);
      const submitVoteButton = page.getByRole('button', { name: 'Submit' });
      await expect(submitVoteButton).toBeEnabled({ timeout: 5_000 });
      await submitVoteButton.click();
      log('submitted vote');
    }

    // Wait for this matchup's result to display before looping back to
    // check whether the next matchup or the final scoreboard comes next.
    debug('waiting for this matchup\'s result to display...');
    await waitVisible(page.getByText(/And the Winner Is|It's a Tie!/), 20_000);
  }

  debug('waiting for the final scoreboard...');
  await waitVisible(page.getByText('Final Scoreboard'), 30_000);
  log('reached the winner screen — leaving this browser open for inspection.');
}

async function runBot(browser, index, code, url, verbose) {
  const name = index < BOT_NAMES.length ? BOT_NAMES[index] : `Bot${index}`;
  const log = (msg) => console.log(`[${name}] ${msg}`);
  const debug = (msg) => { if (verbose) log(`[debug] ${msg}`); };
  let page;

  // Isolate failures per bot — one bot erroring shouldn't cut short the
  // whole batch or the console log for the others (they keep running
  // independently either way, since each is its own async task).
  try {
    const context = await browser.newContext();
    page = await context.newPage();

    debug(`navigating to ${url}/#/join?code=${code}`);
    await page.goto(`${url}/#/join?code=${code}`);
    await page.getByPlaceholder('Enter your name...').fill(name);
    await page.getByRole('button', { name: 'Join Game Room' }).click();
    log('joined lobby, waiting for host to start...');

    await playThroughGame(page, name, verbose);
  } catch (err) {
    reportError(name, err, page, verbose);
  }
}

// Creates the room right away (synchronously, before returning) so the
// caller has a code to hand to the player bots. Returns a `run` function the
// caller kicks off in parallel with the player bots — it waits for everyone
// to join, clicks "Start Game", and then plays through the game exactly like
// any other participant (the host is a real player too).
async function createHostBot(browser, expectedPlayerCount, url, verbose) {
  const name = 'HostBot';
  const log = (msg) => console.log(`[${name}] ${msg}`);
  const debug = (msg) => { if (verbose) log(`[debug] ${msg}`); };
  let page;

  const context = await browser.newContext();
  page = await context.newPage();

  debug(`navigating to ${url}/#/host`);
  await page.goto(`${url}/#/host`);
  await page.getByPlaceholder('Your name...').fill(name);
  await page.getByRole('button', { name: 'Create Room' }).click();
  const code = await page.locator('span.font-display.text-2xl').innerText();
  log(`created room ${code}`);

  const run = async () => {
    try {
      const expectedRosterSize = expectedPlayerCount + 1; // + the host itself
      debug(`waiting for ${expectedRosterSize} player(s) in the lobby before starting...`);
      const everyoneJoined = await waitVisible(
        page.getByText(new RegExp(`Players \\(${expectedRosterSize}\\)`)),
        60_000
      );
      if (!everyoneJoined) debug('not everyone joined in time — starting with whoever is here');
      await page.getByRole('button', { name: 'Start Game' }).click();
      log('started the game');
      await playThroughGame(page, name, verbose);
    } catch (err) {
      reportError(name, err, page, verbose);
    }
  };

  return { code, run };
}

const browser = await chromium.launch({ headless: args.headless });

let code = args.code;
let hostRun = null;
if (args.host) {
  const host = await createHostBot(browser, args.players, args.url, args.verbose);
  code = host.code;
  hostRun = host.run;
}

console.log(`Spawning ${args.players} bot(s) into room ${code} at ${args.url}...\n`);

const botPromises = Array.from({ length: args.players }, (_, i) => runBot(browser, i, code, args.url, args.verbose));
await Promise.all(hostRun ? [hostRun(), ...botPromises] : botPromises);

console.log('\nAll bots finished their run. Press Ctrl+C to close the browsers.');
process.stdin.resume();
process.on('SIGINT', async () => {
  await browser.close();
  process.exit(0);
});
