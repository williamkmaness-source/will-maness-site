// build-theory-tree.mjs
// One-time script: fetches Vienna Opening theory from Lichess Masters API.
// Run from project root: node scripts/build-theory-tree.mjs
// Output: content/projects/vienna-trainer/theory-raw.json
//
// After the script runs, manually curate the output:
//   1. Trim Black responses to Vienna mainlines only (Nf6, Nc6, Bc5 at move 2)
//   2. Add variation names at branch root nodes
//   3. Remove the "games" fields
//   4. Save as content/projects/vienna-trainer/theory.json

import { writeFileSync, mkdirSync } from 'fs';

const API_BASE = 'https://explorer.lichess.ovh/masters';
const MAX_PLIES = 16;           // 8 full moves each side
const MIN_GAMES = 25;           // prune responses below this threshold
const DELAY_MS = 700;           // ms between calls — Lichess rate limit headroom
const MAX_BLACK_RESPONSES = 4;  // cap per Black node; manual curation trims further

// Forced White moves. Key = UCI move sequence so far (comma-joined).
// Without these, the API would pick 1.d4 over 1.e4, Bc4 over Nc3, etc.
const FORCED_WHITE = new Map([
  ['',                                 'e2e4'],  // 1. e4
  ['e2e4,e7e5',                        'b1c3'],  // 2. Nc3  ← the Vienna
  ['e2e4,e7e5,b1c3,g8f6',             'f2f4'],  // 3. f4   ← Vienna Gambit
]);

// After 1.e4, only follow 1...e5. The Sicilian, French, etc. are out of scope.
const RESTRICT_BLACK = new Map([
  ['e2e4', ['e7e5']],
]);

let callCount = 0;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchMoves(moves) {
  const key = moves.join(',');
  const url = key
    ? `${API_BASE}?play=${key}&topGames=0&moves=15`
    : `${API_BASE}?topGames=0&moves=15`;

  await sleep(DELAY_MS);
  callCount++;
  process.stdout.write(`  [${callCount}] ${key || '(start)'} → `);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const data = await res.json();
  process.stdout.write(`${data.moves?.length ?? 0} moves\n`);
  return data;
}

function games(m) { return (m.white ?? 0) + (m.draws ?? 0) + (m.black ?? 0); }
function squares(uci) { return { from: uci.slice(0, 2), to: uci.slice(2, 4) }; }
function nodeId(moves) { return moves.length === 0 ? 'root' : `n${moves.length}_${moves.at(-1)}`; }

async function build(moves, ply) {
  if (ply >= MAX_PLIES) return null;

  const isWhite = moves.length % 2 === 0;
  const moveNumber = Math.floor(moves.length / 2) + 1;
  const posKey = moves.join(',');

  const data = await fetchMoves(moves);
  if (!data.moves?.length) { console.log('    (no moves returned)'); return null; }

  if (isWhite) {
    // White node — one canonical move
    const forced = FORCED_WHITE.get(posKey);
    let pick;

    if (forced) {
      pick = data.moves.find(m => m.uci === forced);
      if (!pick) {
        console.warn(`    Forced ${forced} missing from API response — falling back to top move`);
        pick = data.moves.filter(m => games(m) >= MIN_GAMES).sort((a, b) => games(b) - games(a))[0];
      }
    } else {
      pick = data.moves.filter(m => games(m) >= MIN_GAMES).sort((a, b) => games(b) - games(a))[0];
    }

    if (!pick) { console.log('    (no eligible White move)'); return null; }

    const sq = squares(pick.uci);
    return {
      id: nodeId(moves),
      turn: 'w',
      moveNumber,
      variation: null,
      move: { san: pick.san, from: sq.from, to: sq.to, games: games(pick) },
      next: await build([...moves, pick.uci], ply + 1),
    };

  } else {
    // Black node — weighted response array
    const allowed = RESTRICT_BLACK.get(posKey);
    let candidates = data.moves.filter(m => games(m) >= MIN_GAMES);
    if (allowed) candidates = candidates.filter(m => allowed.includes(m.uci));

    candidates = candidates.sort((a, b) => games(b) - games(a)).slice(0, MAX_BLACK_RESPONSES);
    if (!candidates.length) { console.log('    (no eligible Black responses)'); return null; }

    const total = candidates.reduce((s, m) => s + games(m), 0);
    const responses = [];

    for (const m of candidates) {
      const sq = squares(m.uci);
      responses.push({
        san: m.san,
        from: sq.from,
        to: sq.to,
        weight: Math.round((games(m) / total) * 1000) / 1000,
        games: games(m),
        next: await build([...moves, m.uci], ply + 1),
      });
    }

    return {
      id: nodeId(moves),
      turn: 'b',
      moveNumber,
      variation: null,
      responses,
    };
  }
}

async function main() {
  console.log('Vienna Opening Theory Tree Builder');
  console.log('===================================');
  console.log(`Max depth : ${MAX_PLIES} plies (${MAX_PLIES / 2} full moves)`);
  console.log(`Min games : ${MIN_GAMES}`);
  console.log(`Delay     : ${DELAY_MS}ms per call\n`);

  const tree = await build([], 0);

  mkdirSync('content/projects/vienna-trainer', { recursive: true });
  writeFileSync(
    'content/projects/vienna-trainer/theory-raw.json',
    JSON.stringify({ _meta: { generated: new Date().toISOString(), apiCalls: callCount, source: 'explorer.lichess.ovh/masters', note: 'RAW — curate before use: add variation names, trim fringe Black responses, remove games fields' }, tree }, null, 2),
  );

  console.log(`\nDone — ${callCount} API calls.`);
  console.log('Output: content/projects/vienna-trainer/theory-raw.json');
}

main().catch(err => { console.error(err); process.exit(1); });
