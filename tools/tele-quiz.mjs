#!/usr/bin/env node
// Send a handful of quiz questions to Telegram as native quiz polls.
// One-way only: the bot never receives updates, so no webhook and no long polling.
// Telegram itself grades the tap and reveals the explanation.
//
//   TELEGRAM_TOKEN=... TELEGRAM_CHAT_ID=... node tools/tele-quiz.mjs --slot sang
//
// Flags: --slot <name> | --decks a,b | --n <k> | --dry | --list | --probe

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = path.join(ROOT, 'tools', 'tele-quiz.config.json');
// Tweaking slots on the server would otherwise collide with every git pull.
const LOCAL_CONFIG_FILE = path.join(ROOT, 'tools', 'tele-quiz.config.local.json');
const STATE_FILE = path.join(ROOT, 'tools', '.tele-quiz-state.json');

// Telegram poll limits, Bot API.
const MAX_QUESTION = 300;
const MAX_OPTION = 100;
const MAX_EXPLANATION = 200;
const MAX_MESSAGE = 4096;

const len = (s) => [...String(s ?? '')].length;
const cut = (s, n) => [...String(s)].slice(0, n).join('');

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const out = { flags: new Set(), opt: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out.opt[key] = next; i++; }
    else out.flags.add(key);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const DRY = args.flags.has('dry');

function die(msg) {
  console.error('loi: ' + msg);
  process.exit(1);
}

// ------------------------------------------------------------------- config

const usingLocal = fs.existsSync(LOCAL_CONFIG_FILE);
const config = JSON.parse(fs.readFileSync(usingLocal ? LOCAL_CONFIG_FILE : CONFIG_FILE, 'utf8'));
// Say so out loud: a forgotten local file silently overriding the tracked one
// is the kind of thing you chase for an hour.
if (usingLocal) console.log('dung cau hinh rieng: tools/tele-quiz.config.local.json');
const GAP_MS = config.gapMs ?? 1200;
const BILINGUAL = config.bilingual !== false;
const FULL_EXPLANATION = config.fullExplanation !== false;
const AVOID_LAST = config.avoidRepeatLast ?? 0;

// -------------------------------------------------------------- question pool

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'manifest.json'), 'utf8'));

function loadBank(entry) {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, entry.file), 'utf8'));
  const items = Array.isArray(raw) ? raw : Object.values(raw).find(Array.isArray) ?? [];
  return items.map((q) => ({ ...q, deck: entry.id, deckTitle: entry.title }));
}

// A question is poll-ready only when every option fits. Question text never
// exceeds the limit in this bank, but check anyway so a future edit cannot
// slip a silent failure past us.
function pollReady(q) {
  const n = q.choices?.length ?? 0;
  if (n < 2 || n > 10) return false;
  if (q.choices.some((c) => len(c) > MAX_OPTION)) return false;
  if (len(q.q) > MAX_QUESTION) return false;
  return Number.isInteger(q.answer) && q.answer >= 0 && q.answer < n;
}

function resolveDecks(spec) {
  const all = manifest.quizzes.map((e) => e.id);
  if (!spec || spec === '*' || (Array.isArray(spec) && spec.includes('*'))) return all;
  const want = Array.isArray(spec) ? spec : String(spec).split(',');
  const unknown = want.filter((d) => !all.includes(d));
  if (unknown.length) die('khong co bo: ' + unknown.join(', ') + '\nchay --list de xem danh sach');
  return want;
}

// --------------------------------------------------------------------- --list

if (args.flags.has('list')) {
  console.log('bo\ttong\tlot poll\ttieu de');
  let tot = 0, ok = 0;
  for (const entry of manifest.quizzes) {
    const items = loadBank(entry);
    const fit = items.filter(pollReady).length;
    tot += items.length; ok += fit;
    console.log(`${entry.id}\t${items.length}\t${fit}\t${entry.title}`);
  }
  console.log(`\ntong ${tot} cau, ${ok} lot khuon poll (${(100 * ok / tot).toFixed(1)}%)`);
  console.log('cac cau con lai duoc gui bang tin nhan thuong, dap an giau trong spoiler');
  process.exit(0);
}

// ------------------------------------------------------------- pick questions

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { recent: [] }; }
}

function saveState(state) {
  if (DRY) return;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1) + '\n');
}

// Fisher-Yates, so every question has the same chance of being drawn.
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(deckIds, n, recent) {
  const entries = manifest.quizzes.filter((e) => deckIds.includes(e.id));
  const pool = entries.flatMap(loadBank);
  if (!pool.length) die('khong co cau nao trong cac bo da chon');

  const seen = new Set(recent);
  const fresh = pool.filter((q) => !seen.has(q.deck + '/' + q.id));
  // Fall back to the whole pool once the recent window has eaten it, otherwise
  // a narrow slot would go silent instead of repeating.
  const source = fresh.length >= n ? fresh : pool;
  return shuffle(source).slice(0, n);
}

// ------------------------------------------------------------ message shaping

// Prefer the richest heading that still fits: deck name and both languages,
// then drop pieces in order of what hurts least to lose.
function pollQuestion(q) {
  const candidates = BILINGUAL
    ? [`${q.deckTitle}\n${q.q}\n${q.q_vi ?? ''}`, `${q.q}\n${q.q_vi ?? ''}`, `${q.deckTitle}\n${q.q}`, q.q]
    : [`${q.deckTitle}\n${q.q}`, q.q];
  for (const c of candidates) {
    const t = c.trim();
    if (len(t) <= MAX_QUESTION) return t;
  }
  return cut(q.q, MAX_QUESTION);
}

function explanationOf(q) {
  return (q.why_vi || q.why || '').trim();
}

// Trim on a word boundary so the poll bubble never ends mid-word.
function trimExplanation(text) {
  if (len(text) <= MAX_EXPLANATION) return { text, truncated: false };
  const room = cut(text, MAX_EXPLANATION - 1);
  const at = Math.max(room.lastIndexOf(' '), room.lastIndexOf('. '));
  const short = (at > 40 ? room.slice(0, at) : room).trimEnd();
  return { text: short + '…', truncated: true };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// Used when an option is too long for a poll. The answer sits inside a spoiler,
// so it still reads as a question first and an answer only after a tap.
function fallbackMessage(q) {
  const head = `<b>${esc(q.deckTitle)}</b>\n${esc(q.q)}`;
  const vi = BILINGUAL && q.q_vi ? `\n<i>${esc(q.q_vi)}</i>` : '';
  const opts = q.choices.map((c, i) => `${LETTERS[i]}. ${esc(c)}`).join('\n');
  const why = explanationOf(q);
  const reveal = `<tg-spoiler>Dap an: ${LETTERS[q.answer]}. ${esc(q.choices[q.answer])}`
    + (why ? `\n\n${esc(why)}` : '') + '</tg-spoiler>';
  // The answer block is never what gets dropped: a message trimmed from the
  // right would arrive as a question with no answer and nothing would say so.
  let body = `${head}${vi}\n\n${opts}\n\n${reveal}`;
  if (len(body) > MAX_MESSAGE) body = `${head}\n\n${opts}\n\n${reveal}`;
  if (len(body) > MAX_MESSAGE) {
    const room = MAX_MESSAGE - len(reveal) - 2;
    body = room > 0 ? `${cut(`${head}\n\n${opts}`, room)}\n\n${reveal}` : reveal;
  }
  return body;
}

// ------------------------------------------------------------------ transport

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, payload, attempt = 0) {
  if (DRY) { console.log(`\n[dry] ${method}\n` + JSON.stringify(payload, null, 1)); return { ok: true }; }
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, ...payload }),
  });
  const json = await res.json().catch(() => ({ ok: false, description: 'khong doc duoc phan hoi' }));
  // 429 carries the exact wait, so honour it once rather than guessing a backoff.
  if (!json.ok && res.status === 429 && attempt === 0) {
    const wait = (json.parameters?.retry_after ?? 3) * 1000 + 500;
    console.error(`  bi gioi han toc do, cho ${wait} ms roi thu lai`);
    await sleep(wait);
    return call(method, payload, attempt + 1);
  }
  if (!json.ok) throw new Error(`${method} that bai (${res.status}): ${json.description}`);
  return json;
}

// Single place where a question becomes a request, so --audit checks the very
// payload that would go on the wire and not a second copy of the rules.
function buildPayload(q) {
  if (pollReady(q)) {
    const full = explanationOf(q);
    const { text: explanation, truncated } = trimExplanation(full);
    return {
      method: 'sendPoll',
      truncated,
      full,
      payload: {
        question: pollQuestion(q),
        options: q.choices.map((c) => ({ text: String(c) })),
        type: 'quiz',
        correct_option_id: q.answer,
        is_anonymous: false,
        explanation: explanation || undefined,
      },
    };
  }
  return {
    method: 'sendMessage',
    truncated: false,
    full: explanationOf(q),
    payload: { text: fallbackMessage(q), parse_mode: 'HTML' },
  };
}

async function sendOne(q, index, total) {
  const label = `${index + 1}/${total} ${q.deck}/${q.id}`;
  const { method, payload, truncated } = buildPayload(q);
  if (method === 'sendPoll') {
    const full = explanationOf(q);
    await call('sendPoll', payload);
    console.log(`  ${label} poll`);
    if (truncated && FULL_EXPLANATION) {
      await sleep(GAP_MS);
      await call('sendMessage', {
        text: `<tg-spoiler>${esc(full)}</tg-spoiler>`,
        parse_mode: 'HTML',
      });
      console.log(`  ${label} giai thich day du`);
    }
  } else {
    await call('sendMessage', payload);
    console.log(`  ${label} tin nhan (phuong an qua dai)`);
  }
}

// --------------------------------------------------------------------- --audit

// Build the request for every question in the bank and assert the Telegram
// limits hold. A shaping bug would otherwise show up as one silent 400 in the
// middle of a cron run, months from now.
if (args.flags.has('audit')) {
  const problems = [];
  let polls = 0, msgs = 0, extra = 0;
  for (const entry of manifest.quizzes) {
    for (const q of loadBank(entry)) {
      const where = `${q.deck}/${q.id}`;
      // Checked for every question, not only the poll branch: a bad answer
      // index used to slide into the fallback message as "Dap an: undefined".
      if (!String(q.q ?? '').trim()) problems.push(`${where}: khong co de bai`);
      const ch = q.choices ?? [];
      if (ch.length < 2) problems.push(`${where}: chi co ${ch.length} lua chon`);
      if (ch.some((c) => !String(c ?? '').trim())) problems.push(`${where}: co lua chon rong`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= ch.length) {
        problems.push(`${where}: answer ${q.answer} ngoai khoang 0..${ch.length - 1}`);
        continue;
      }

      let built;
      try { built = buildPayload(q); }
      catch (err) { problems.push(`${where}: dung payload that bai: ${err.message}`); continue; }
      const p = built.payload;
      if (built.method === 'sendPoll') {
        polls++;
        if (built.truncated) extra++;
        if (len(p.question) > MAX_QUESTION) problems.push(`${where}: de bai ${len(p.question)} ky tu`);
        if (!p.question.trim()) problems.push(`${where}: de bai rong`);
        if (p.options.length < 2 || p.options.length > 10) problems.push(`${where}: ${p.options.length} lua chon`);
        for (const [i, o] of p.options.entries()) {
          if (len(o.text) > MAX_OPTION) problems.push(`${where}: lua chon ${i} dai ${len(o.text)}`);
          if (!o.text.trim()) problems.push(`${where}: lua chon ${i} rong`);
        }
        if (p.explanation && len(p.explanation) > MAX_EXPLANATION) {
          problems.push(`${where}: giai thich ${len(p.explanation)} ky tu`);
        }
        if (!(p.correct_option_id >= 0 && p.correct_option_id < p.options.length)) {
          problems.push(`${where}: correct_option_id ${p.correct_option_id} ngoai khoang`);
        }
      } else {
        msgs++;
        if (len(p.text) > MAX_MESSAGE) problems.push(`${where}: tin nhan ${len(p.text)} ky tu`);
        // An unbalanced spoiler tag makes Telegram reject the whole message.
        const open = (p.text.match(/<tg-spoiler>/g) ?? []).length;
        const close = (p.text.match(/<\/tg-spoiler>/g) ?? []).length;
        if (open !== 1 || close !== 1) problems.push(`${where}: the spoiler lech (${open}/${close})`);
        if (!p.text.includes('Dap an:')) problems.push(`${where}: khong co dap an`);
      }
    }
  }
  console.log(`kiem ${polls + msgs} cau: ${polls} poll, ${msgs} tin nhan thuong, ${extra} cau kem giai thich day du`);
  if (problems.length) {
    console.error(`\n${problems.length} van de:`);
    for (const p of problems.slice(0, 40)) console.error('  ' + p);
    process.exit(1);
  }
  console.log('moi payload nam trong gioi han Telegram');
  process.exit(0);
}

// --------------------------------------------------------------------- --probe

if (args.flags.has('probe')) {
  if (!DRY && (!TOKEN || !CHAT_ID)) die('thieu TELEGRAM_TOKEN hoac TELEGRAM_CHAT_ID');
  await call('sendPoll', {
    question: 'Thu duong truyen. Cau nay se hien dung sai ngay khi ban bam.',
    options: [{ text: 'Bam vao day' }, { text: 'Dung bam vao day' }],
    type: 'quiz',
    correct_option_id: 0,
    is_anonymous: false,
    explanation: 'Neu ban doc duoc dong nay thi quiz poll chay duoc, dung script that duoc roi.',
  });
  console.log('da gui poll thu');
  process.exit(0);
}

// ----------------------------------------------------------------------- main

const slotName = args.opt.slot;
let deckSpec = args.opt.decks;
let count = args.opt.n ? Number(args.opt.n) : undefined;

if (slotName) {
  const slot = config.slots?.[slotName];
  if (!slot) die(`khong co khung gio "${slotName}", dang co: ` + Object.keys(config.slots ?? {}).join(', '));
  deckSpec ??= slot.decks;
  count ??= slot.n;
}
if (!deckSpec) die('phai co --slot <ten> hoac --decks a,b');
count ??= 5;
if (!Number.isInteger(count) || count < 1) die('--n phai la so nguyen duong');

if (!DRY && (!TOKEN || !CHAT_ID)) die('thieu TELEGRAM_TOKEN hoac TELEGRAM_CHAT_ID trong bien moi truong');

// The log is append-only across months, so every run stamps itself. Without
// this there is no way to tell a cron run from someone testing by hand.
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const deckIds = resolveDecks(deckSpec);
const state = loadState();
const chosen = pick(deckIds, count, state.recent ?? []);

console.log(`\n[${stamp()}] gui ${chosen.length} cau tu ${deckIds.length} bo${slotName ? ` (khung "${slotName}")` : ''}`);

let sent = 0;
for (const [i, q] of chosen.entries()) {
  try {
    await sendOne(q, i, chosen.length);
    sent++;
    // One message per second per chat is the documented ceiling.
    if (i < chosen.length - 1) await sleep(GAP_MS);
  } catch (err) {
    console.error(`  bo qua ${q.deck}/${q.id}: ${err.message}`);
  }
}

if (AVOID_LAST > 0) {
  const recent = [...(state.recent ?? []), ...chosen.map((q) => q.deck + '/' + q.id)];
  state.recent = recent.slice(-AVOID_LAST);
  saveState(state);
}

console.log(`[${stamp()}] xong: ${sent}/${chosen.length}`);
process.exit(sent === chosen.length ? 0 : 1);
