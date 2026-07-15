#!/usr/bin/env node

// -------------------------------------------------------------
// In-Memory Pub-Sub Network Mock for ntfy.sh
// -------------------------------------------------------------
const subscribers = new Map(); // topic -> Set of controllers

global.fetch = async (urlStr, options = {}) => {
  const url = new URL(urlStr);
  const path = url.pathname;
  const parts = path.split('/').filter(Boolean);
  const topic = parts[0];
  const isSubscribe = parts[1] === 'json';

  if (isSubscribe) {
    let controllerRef;
    const stream = new ReadableStream({
      start(controller) {
        controllerRef = controller;
        if (!subscribers.has(topic)) {
          subscribers.set(topic, new Set());
        }
        subscribers.get(topic).add(controller);
      },
      cancel() {
        if (subscribers.has(topic)) {
          subscribers.get(topic).delete(controllerRef);
        }
      }
    });

    const signal = options.signal;
    if (signal) {
      signal.addEventListener('abort', () => {
        if (subscribers.has(topic)) {
          subscribers.get(topic).delete(controllerRef);
        }
      });
    }

    return {
      ok: true,
      body: stream
    };
  } else {
    // Publish
    const bodyStr = options.body;
    const eventJson = JSON.stringify({
      event: 'message',
      message: bodyStr
    }) + '\n';

    // Broadcast to all subscribers for this topic
    const list = subscribers.get(topic);
    if (list) {
      for (const controller of list) {
        try {
          controller.enqueue(new TextEncoder().encode(eventJson));
        } catch {
          // ignore closed controllers
        }
      }
    }

    return {
      ok: true
    };
  }
};

// Mock ntfyBaseUrl to match mock routing
global.ntfyBaseUrl = () => 'https://mock-ntfy.local';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Generate a random room code
const code = 'TEST' + Math.floor(1000 + Math.random() * 9000);
const topic = `brodin-games-${code.toLowerCase()}`;
console.log(`Mock Host starting room ${code} on topic ${topic}`);

const roster = [];
const playerAnswers = {};
const playerVotes = {};
let currentRound = 1;

// Subscribe to fetch/pub-sub as Host
const abortController = new AbortController();

const runHost = async () => {
  try {
    const res = await fetch(`https://mock-ntfy.local/${topic}/json`, { signal: abortController.signal });
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
        const event = JSON.parse(line);
        if (event.event === 'message' && event.message) {
          const envelope = JSON.parse(event.message);
          await handleHostEnvelope(envelope);
        }
      }
    }
  } catch (err) {
    if (!abortController.signal.aborted) {
      console.error('Host subscription error:', err);
    }
  }
};

async function handleHostEnvelope(envelope) {
  const { type, playerId, payload } = envelope;

  if (type === 'join-request') {
    console.log(`[Host] Received join request from ${payload.name} (${playerId})`);
    const newPlayer = { id: playerId, name: payload.name };
    roster.push(newPlayer);
    
    await fetch(`https://mock-ntfy.local/${topic}`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'join-ack',
        playerId,
        timestamp: Date.now(),
        payload: { accepted: true, gameId: 'joke-factory' }
      })
    });

    await fetch(`https://mock-ntfy.local/${topic}`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'roster-update',
        timestamp: Date.now(),
        payload: { players: roster }
      })
    });

    if (roster.length === 3) {
      console.log('[Host] 3 players joined, starting Joke Factory Round 1...');
      await startRound(1);
    }
  } else if (type === 'submit-answers') {
    console.log(`[Host] Received answers from ${playerId}`);
    playerAnswers[playerId] = payload.answers;

    if (Object.keys(playerAnswers).length === roster.length) {
      console.log(`[Host] All answers submitted! Advancing to voting for Round ${currentRound}...`);
      await startVoting(currentRound, 0);
    }
  } else if (type === 'submit-vote') {
    console.log(`[Host] Received vote from ${playerId}: ${payload.choice}`);
    playerVotes[playerId] = payload.choice;

    if (currentRound === 3) {
      const expectedVotes = roster.length;
      const voteCount = Object.keys(playerVotes).length;
      if (voteCount >= expectedVotes) {
        console.log(`[Host] Round 3 voting complete. Advancing to leaderboard...`);
        await startLeaderboard();
      }
    } else {
      const expectedVotes = roster.length - 2;
      const voteCount = Object.keys(playerVotes).length;

      if (voteCount >= expectedVotes) {
        console.log(`[Host] Matchup voting complete. Advancing to Round 3...`);
        await startRound(3);
      }
    }
  }
}

async function startLeaderboard() {
  const state = {
    phase: 'leaderboard',
    round: 3,
    playerPrompts: {},
    playerAnswers,
    matchups: [],
    currentMatchIndex: 0,
    round3Data: null,
    scores: {
      [roster[0].id]: 1000,
      [roster[1].id]: 800,
      [roster[2].id]: 600,
    },
    roundPoints: {},
    writingEndTimestamp: null,
    votingEndTimestamp: null,
    resultsEndTimestamp: null,
  };

  await fetch(`https://mock-ntfy.local/${topic}`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'joke-factory-state-update',
      timestamp: Date.now(),
      payload: state
    })
  });
}

async function startRound(round) {
  currentRound = round;
  for (const k in playerAnswers) delete playerAnswers[k];
  for (const k in playerVotes) delete playerVotes[k];

  let playerPrompts = {};
  if (round === 3) {
    const p = { id: 'p3', text: 'The worst name for a baby toy' };
    roster.forEach(pl => {
      playerPrompts[pl.id] = [p];
    });
  } else {
    const p1 = { id: 'p1', text: 'The worst name for a new perfume' };
    const p2 = { id: 'p2', text: 'A name for a very untrustworthy airline' };
    const p3 = { id: 'p3', text: 'Something you shouldn\'t say during a job interview' };
    
    playerPrompts[roster[0].id] = [p3, p1];
    playerPrompts[roster[1].id] = [p1, p2];
    playerPrompts[roster[2].id] = [p2, p3];
  }

  const state = {
    phase: 'writing',
    round,
    playerPrompts,
    playerAnswers: {},
    matchups: [],
    currentMatchIndex: 0,
    round3Data: null,
    scores: {},
    roundPoints: {},
    writingEndTimestamp: Date.now() + 30000,
    votingEndTimestamp: null,
    resultsEndTimestamp: null,
  };

  await fetch(`https://mock-ntfy.local/${topic}`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'joke-factory-state-update',
      timestamp: Date.now(),
      payload: state
    })
  });
}

async function startVoting(round, matchIdx) {
  for (const k in playerVotes) delete playerVotes[k];

  let matchups = [];
  let round3Data = null;

  if (round === 3) {
    const singlePrompt = { id: 'p3', text: 'The worst name for a baby toy' };
    const answers = {};
    roster.forEach((p) => {
      answers[p.id] = playerAnswers[p.id]?.[singlePrompt.id] || 'Funny joke!';
    });
    round3Data = {
      prompt: singlePrompt,
      answers,
      votes: {}
    };
  } else {
    const p1 = { id: 'p1', text: 'The worst name for a new perfume' };
    matchups = [
      {
        prompt: p1,
        leftPlayerId: roster[0].id,
        rightPlayerId: roster[1].id,
        leftAnswer: playerAnswers[roster[0].id]['p1'],
        rightAnswer: playerAnswers[roster[1].id]['p1'],
        votes: {}
      }
    ];
  }

  const state = {
    phase: 'voting',
    round,
    playerPrompts: {},
    playerAnswers,
    matchups,
    currentMatchIndex: matchIdx,
    round3Data,
    scores: {},
    roundPoints: {},
    writingEndTimestamp: null,
    votingEndTimestamp: Date.now() + 20000,
    resultsEndTimestamp: null,
  };

  await fetch(`https://mock-ntfy.local/${topic}`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'joke-factory-state-update',
      timestamp: Date.now(),
      payload: state
    })
  });
}

runHost();

setTimeout(async () => {
  const { ApiBot } = await import('./simulate-players-api.js');
  console.log('Spawning 3 API bots...');
  
  const b1 = new ApiBot(code, 'Alice', true);
  const b2 = new ApiBot(code, 'Bob', true);
  const b3 = new ApiBot(code, 'Charlie', true);

  console.log('Alice running...');
  const p1 = b1.run();
  
  console.log('Bob running...');
  const p2 = b2.run();

  console.log('Charlie running...');
  const p3 = b3.run();

  Promise.all([p1, p2, p3]).then(() => {
    console.log('All bots finished their runs! Test PASSED.');
    abortController.abort();
    process.exit(0);
  }).catch((err) => {
    console.error('Test failed with error:', err);
    abortController.abort();
    process.exit(1);
  });
}, 100);
