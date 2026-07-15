#!/usr/bin/env node
// Lightweight API-level player bots: speaks the same ntfy JSON envelope
// protocol the real app uses (join-request, word-library-submit,
// sheet-submit, vote-submit, ...) directly over HTTP, with no browser at
// all. Much faster and immune to the click-timing races a Playwright bot
// can hit (a vote card going stale mid-click, etc.) — use this when you
// just need bots to push a session through to the end quickly and
// reliably (e.g. to verify game/reliability logic end-to-end), not to
// exercise the actual rendered UI. For that, use simulate-players.js or a
// manual browser.
//
// Usage:
//   npm run simulate:api -- --code=ABCD --players=5 [--verbose]
//
// Always joins an EXISTING room (create one yourself, manually or with
// simulate-players.js --host) — it doesn't spin up its own host, since the
// host owns real game logic (matchmaking, scoring, round pacing) that only
// the real app implements.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Mirrors src/apps/memo-random/constants.ts / src/shared/constants.ts — kept
// as plain literals here since this script doesn't run through a TS/Vite
// loader and so can't import those directly.
const JOIN_RETRY_INTERVAL_MS = 1500;
const JOIN_MAX_ATTEMPTS = 5;
const SUBMIT_RETRY_INTERVAL_MS = 1200;
const SUBMIT_MAX_ATTEMPTS = 8;
const MAX_WORDS_PER_CATEGORY = 5;
const MIN_DROPDOWN_OPTIONS = 5;

const BOT_NAMES = ['Bilbo', 'Frodo', 'Gandalf', 'Aragorn', 'Legolas', 'Gimli', 'Boromir', 'Samwise', 'Merry', 'Pippin', 'Galadriel', 'Elrond'];

const WORD_POOLS = {
  noun: ['dog', 'cat', 'fox', 'house', 'tree', 'car', 'book', 'chair', 'apple', 'river', 'mountain', 'robot', 'pizza', 'guitar', 'bicycle'],
  verb: ['run', 'jump', 'walk', 'sing', 'dance', 'laugh', 'swim', 'climb', 'cook', 'paint', 'sleep', 'shout'],
  adjective: ['happy', 'blue', 'big', 'tiny', 'loud', 'quiet', 'shiny', 'fast', 'slow', 'brave', 'silly', 'ancient'],
};

function loadEnv() {
  const envPath = join(ROOT, '.env');
  const env = {};
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  }
  return env;
}

const env = loadEnv();
const NTFY_SERVER_URL = env.VITE_NTFY_SERVER_URL || 'ntfy.sh';
const NTFY_USERNAME = env.VITE_NTFY_ADMIN_USERNAME || '';
const NTFY_PASSWORD = env.VITE_NTFY_ADMIN_PASSWORD || '';

const FALLBACK_WORDS = JSON.parse(
  readFileSync(join(ROOT, 'src/apps/memo-random/data/fallbackWords.json'), 'utf-8')
);

function ntfyBaseUrl() {
  const domain = NTFY_SERVER_URL.replace(/^(https?:\/\/)/, '');
  const protocol = domain.startsWith('localhost') || domain.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${domain}`;
}

function authHeaders() {
  if (!NTFY_USERNAME || !NTFY_PASSWORD) return {};
  // Plain Authorization header is fine here (unlike the browser client) —
  // there's no CORS preflight to dodge outside a browser context.
  return { Authorization: `Basic ${Buffer.from(`${NTFY_USERNAME}:${NTFY_PASSWORD}`).toString('base64')}` };
}

async function publish(topic, payload) {
  const res = await fetch(`${ntfyBaseUrl()}/${topic}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`publish failed: ${res.status} ${res.statusText}`);
}

// ntfy's streaming JSON endpoint: a long-lived HTTP GET, one JSON object per
// line. Same message shape as the app's own WebSocket (`{ event, message }`,
// where `message` is itself the JSON-stringified envelope). Used instead of
// a real WebSocket so this script needs zero extra npm dependencies.
async function subscribe(topic, onEnvelope, signal) {
  const res = await fetch(`${ntfyBaseUrl()}/${topic}/json`, { headers: authHeaders(), signal });
  if (!res.ok || !res.body) throw new Error(`subscribe failed: ${res.status} ${res.statusText}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.event === 'message' && event.message) {
        try {
          onEnvelope(JSON.parse(event.message));
        } catch {
          // Malformed envelope — ignore, matches the app's own onmessage try/catch.
        }
      }
    }
  }
}

function shuffled(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function dedupe(arr) {
  return Array.from(new Set(arr));
}

// Mirrors src/apps/memo-random/utils/fallbackMerge.ts's buildDropdownOptions,
// simplified to only what's needed to pick one valid answer per blank.
function pickAnswers(template, assignedLibrary, rosterNames) {
  const optionsByCategory = {};
  const answers = {};
  for (const blank of template.blanks) {
    if (!optionsByCategory[blank.category]) {
      if (blank.category === 'pronoun') {
        optionsByCategory.pronoun = dedupe(rosterNames);
      } else {
        const real = dedupe(assignedLibrary[blank.category] || []);
        if (real.length >= MIN_DROPDOWN_OPTIONS) {
          optionsByCategory[blank.category] = real;
        } else {
          const existing = new Set(real);
          const filler = shuffled((FALLBACK_WORDS[blank.category] || []).filter((w) => !existing.has(w)));
          optionsByCategory[blank.category] = [...real, ...filler.slice(0, Math.max(0, MIN_DROPDOWN_OPTIONS - real.length))];
        }
      }
    }
    const options = optionsByCategory[blank.category];
    answers[blank.id] = options[Math.floor(Math.random() * options.length)] ?? '';
  }
  return answers;
}

function parseArgs(argv) {
  const args = { players: 1, code: null, verbose: false };
  for (const arg of argv) {
    const stripped = arg.replace(/^--/, '');
    const eq = stripped.indexOf('=');
    const key = eq === -1 ? stripped : stripped.slice(0, eq);
    const value = eq === -1 ? 'true' : stripped.slice(eq + 1);
    if (key === 'players') args.players = parseInt(value, 10);
    else if (key === 'code') args.code = value.toUpperCase();
    else if (key === 'verbose') args.verbose = value !== 'false';
  }
  return args;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export class ApiBot {
  constructor(code, name, verbose) {
    this.name = name;
    this.verbose = verbose;
    this.playerId = 'p-' + Math.random().toString(36).slice(2, 9);
    this.topic = `brodin-games-${code.toLowerCase()}`;
    this.roster = [];
    this.joined = false;
    this.round1Submitted = false;
    this.round1Acked = false;
    this.round2Submitted = false;
    this.round2Acked = false;
    this.currentMatchIndex = null;
    this.voteAcked = false;
    this.done = false;
    this.lastCompletedPhase = null;
    this.abortController = new AbortController();
  }

  log(msg) {
    console.log(`[${this.name}] ${msg}`);
  }

  debug(msg) {
    if (this.verbose) this.log(`[debug] ${msg}`);
  }

  async publish(payload) {
    try {
      await publish(this.topic, payload);
    } catch (e) {
      this.debug(`publish error: ${e.message}`);
    }
  }

  async run() {
    const subscribePromise = subscribe(this.topic, (e) => this.handle(e), this.abortController.signal).catch((e) => {
      if (!this.abortController.signal.aborted) this.log(`subscribe error: ${e.message}`);
    });
    // Give the subscription a moment to actually establish before publishing,
    // so our own join-ack echo isn't missed.
    await sleep(500);
    await this.joinWithRetry();
    await subscribePromise;
  }

  finish(reason) {
    if (this.done) return;
    this.done = true;
    this.debug(`done: ${reason}`);
    this.abortController.abort();
  }

  async joinWithRetry() {
    let attempts = 0;
    while (!this.joined && attempts < JOIN_MAX_ATTEMPTS && !this.done) {
      await this.publish({ type: 'join-request', playerId: this.playerId, timestamp: Date.now(), payload: { name: this.name } });
      attempts++;
      await sleep(JOIN_RETRY_INTERVAL_MS);
    }
    if (!this.joined) this.log('could not reach the host — giving up');
  }

  handle(envelope) {
    if (envelope.type === 'join-ack' && envelope.playerId === this.playerId) {
      if (envelope.payload.accepted) {
        if (!this.joined) this.log('joined lobby, waiting for host to start...');
        this.joined = true;
      } else {
        this.log(`join rejected: ${envelope.payload.reason}`);
        this.finish('join rejected');
      }
    } else if (envelope.type === 'roster-update') {
      this.roster = envelope.payload.players;
    } else if (envelope.type === 'round1-start' && this.joined && !this.round1Submitted) {
      this.submitRound1();
    } else if (envelope.type === 'word-library-ack' && envelope.playerId === this.playerId) {
      this.round1Acked = true;
    } else if (envelope.type === 'round2-assignments' && this.joined) {
      this.handleRound2Assignments(envelope.payload);
    } else if (envelope.type === 'sheet-submit-ack' && envelope.playerId === this.playerId) {
      this.round2Acked = true;
    } else if (envelope.type === 'matchup-start') {
      this.handleMatchupStart(envelope.payload);
    } else if (envelope.type === 'vote-submit-ack' && envelope.playerId === this.playerId) {
      if (envelope.payload.matchIndex === this.currentMatchIndex) this.voteAcked = true;
    } else if (envelope.type === 'match-result') {
      this.debug(`matchup ${envelope.payload.matchIndex + 1}/${envelope.payload.totalMatches} result in`);
    } else if (envelope.type === 'winner-announced') {
      const myScore = envelope.payload.scores[this.playerId] ?? 0;
      const won = envelope.payload.winnerPlayerIds.includes(this.playerId);
      this.log(`reached the winner screen (score: ${myScore}${won ? ', WINNER' : ''})`);
      this.finish('winner-announced');
    } else if (envelope.type === 'joke-factory-state-update' && this.joined) {
      this.handleJokeFactoryUpdate(envelope.payload);
    }
  }

  async handleJokeFactoryUpdate(state) {
    if (this.done) return;
    const phase = state.phase;
    const round = state.round;

    if (phase === 'writing') {
      const roundKey = `r${round}-writing`;
      if (this.lastCompletedPhase === roundKey) return;

      const myPrompts = state.playerPrompts[this.playerId];
      if (!myPrompts || myPrompts.length === 0) return;

      if (state.playerAnswers[this.playerId]) {
        this.lastCompletedPhase = roundKey;
        return;
      }

      this.lastCompletedPhase = roundKey;
      const answers = {};
      myPrompts.forEach((pr) => {
        const adj = WORD_POOLS.adjective[Math.floor(Math.random() * WORD_POOLS.adjective.length)];
        const noun = WORD_POOLS.noun[Math.floor(Math.random() * WORD_POOLS.noun.length)];
        answers[pr.id] = `The ${adj} ${noun} (${this.name})`;
      });

      this.log(`submitting ${myPrompts.length} punchlines for round ${round}`);
      await this.publish({
        type: 'submit-answers',
        playerId: this.playerId,
        timestamp: Date.now(),
        payload: { answers }
      });
    } else if (phase === 'voting') {
      if (round === 3) {
        const roundKey = `r3-voting`;
        if (this.lastCompletedPhase === roundKey) return;

        const r3Data = state.round3Data;
        if (!r3Data) return;

        if (r3Data.votes[this.playerId]) {
          this.lastCompletedPhase = roundKey;
          return;
        }

        this.lastCompletedPhase = roundKey;
        const candidates = this.roster.filter((p) => p.id !== this.playerId);
        if (candidates.length > 0) {
          const choice = candidates[Math.floor(Math.random() * candidates.length)].id;
          this.log(`voting for ${choice} in round 3`);
          await this.publish({
            type: 'submit-vote',
            playerId: this.playerId,
            timestamp: Date.now(),
            payload: { choice }
          });
        }
      } else {
        const matchIdx = state.currentMatchIndex;
        const roundKey = `r${round}-match-${matchIdx}`;
        if (this.lastCompletedPhase === roundKey) return;

        const matchup = state.matchups[matchIdx];
        if (!matchup) return;

        if (this.playerId === matchup.leftPlayerId || this.playerId === matchup.rightPlayerId) {
          this.lastCompletedPhase = roundKey;
          return;
        }

        if (matchup.votes[this.playerId]) {
          this.lastCompletedPhase = roundKey;
          return;
        }

        this.lastCompletedPhase = roundKey;
        const choice = Math.random() > 0.5 ? 'left' : 'right';
        this.log(`voting ${choice} on matchup ${matchIdx + 1}`);
        await this.publish({
          type: 'submit-vote',
          playerId: this.playerId,
          timestamp: Date.now(),
          payload: { choice }
        });
      }
    } else if (phase === 'leaderboard' && round === 3) {
      const myScore = state.scores[this.playerId] ?? 0;
      this.log(`reached final leaderboard (score: ${myScore})`);
      this.finish('game-finished');
    }
  }

  // Submits an already-maxed-out (5/5/5) library immediately — there's no UI
  // to type into, so there's no reason to simulate typing delay at all.
  async submitRound1() {
    this.round1Submitted = true;
    const library = { noun: [], verb: [], adjective: [], pronoun: [] };
    for (const [category, pool] of Object.entries(WORD_POOLS)) {
      library[category] = shuffled(pool).slice(0, MAX_WORDS_PER_CATEGORY);
    }
    this.log(`typed ${MAX_WORDS_PER_CATEGORY * 3} words (maxed out all categories)`);
    let attempts = 0;
    while (!this.round1Acked && attempts < SUBMIT_MAX_ATTEMPTS && !this.done) {
      await this.publish({ type: 'word-library-submit', playerId: this.playerId, timestamp: Date.now(), payload: { library } });
      attempts++;
      await sleep(SUBMIT_RETRY_INTERVAL_MS);
    }
  }

  async handleRound2Assignments(payload) {
    if (this.round2Submitted) return;
    this.round2Submitted = true;
    const mine = payload.assignments[this.playerId];
    if (!mine) {
      this.log('sat out round 2 (submission arrived too late)');
      return;
    }
    const answers = pickAnswers(mine.template, mine.library, this.roster.map((p) => p.name));
    let attempts = 0;
    while (!this.round2Acked && attempts < SUBMIT_MAX_ATTEMPTS && !this.done) {
      await this.publish({ type: 'sheet-submit', playerId: this.playerId, timestamp: Date.now(), payload: { answers } });
      attempts++;
      await sleep(SUBMIT_RETRY_INTERVAL_MS);
    }
    this.log('submitted round 2 sheet');
  }

  async handleMatchupStart(payload) {
    const matchIndex = payload.matchIndex;
    this.currentMatchIndex = matchIndex;
    this.voteAcked = false;
    const isOwnMemo = payload.left.playerId === this.playerId || payload.right.playerId === this.playerId;
    if (isOwnMemo) {
      this.debug(`matchup ${matchIndex + 1}: sitting out (it's my own memo)`);
      return;
    }
    const side = Math.random() < 0.5 ? 'left' : 'right';
    let attempts = 0;
    while (!this.voteAcked && attempts < SUBMIT_MAX_ATTEMPTS && !this.done && this.currentMatchIndex === matchIndex) {
      await this.publish({ type: 'vote-submit', playerId: this.playerId, timestamp: Date.now(), payload: { matchIndex, side, final: true } });
      attempts++;
      await sleep(SUBMIT_RETRY_INTERVAL_MS);
    }
    if (this.currentMatchIndex === matchIndex) this.log(`voted on matchup ${matchIndex + 1}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('simulate-players-api.js')) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.code || args.code.length !== 4 || !Number.isInteger(args.players) || args.players < 1) {
    console.error('Usage: npm run simulate:api -- --code=ABCD --players=5 [--verbose]');
    process.exit(1);
  }

  console.log(`Spawning ${args.players} API bot(s) into room ${args.code}...\n`);
  const bots = Array.from({ length: args.players }, (_, i) => new ApiBot(args.code, BOT_NAMES[i] ?? `Bot${i}`, args.verbose));
  await Promise.all(bots.map((b) => b.run()));
  console.log('\nAll bots finished their run.');
}
