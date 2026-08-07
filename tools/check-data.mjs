#!/usr/bin/env node
// Cong kiem du lieu. Chay: node tools/check-data.mjs
// Bat loi truoc khi day len, vi trang tinh khong co buoc build de bat ho.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const errors = [];
const warnings = [];

function err(where, msg) { errors.push(`${where}: ${msg}`); }
function warn(where, msg) { warnings.push(`${where}: ${msg}`); }

async function readJSON(rel) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) { err(rel, 'không tồn tại'); return null; }
  try {
    return JSON.parse(await readFile(abs, 'utf8'));
  } catch (e) {
    err(rel, `JSON hỏng — ${e.message}`);
    return null;
  }
}

const seenIds = new Set();

function checkCard(c, where, lang) {
  const head = lang === 'ru-vi' ? c.ru : c.en;
  if (!c.id) err(where, 'thẻ thiếu id');
  else if (seenIds.has(c.id)) err(where, `id trùng: ${c.id}`);
  else seenIds.add(c.id);

  if (!head) err(where, `thẻ ${c.id} thiếu mặt trước (${lang === 'ru-vi' ? 'ru' : 'en'})`);
  if (!c.vi) err(where, `thẻ ${c.id} thiếu nghĩa tiếng Việt (vi)`);

  const defA = lang === 'ru-vi' ? c.def_ru : c.def_en;
  if (!defA) warn(where, `thẻ ${c.id} chưa có định nghĩa gốc`);
  if (!c.def_vi) warn(where, `thẻ ${c.id} chưa có định nghĩa tiếng Việt`);
  if (!Array.isArray(c.tags) || !c.tags.length) warn(where, `thẻ ${c.id} chưa gắn nhãn nào, câu hỏi sinh ra sẽ kém chọn lọc`);

  for (const [k, v] of Object.entries(c)) {
    if (typeof v === 'string' && /[—–]|(?:^|\s)--(?:\s|$)/.test(v)) {
      warn(where, `thẻ ${c.id}, trường ${k}: có dấu gạch dài dùng như dấu câu`);
    }
  }
}

function checkQuestion(q, where) {
  if (!q.id) err(where, 'câu hỏi thiếu id');
  if (!q.q) err(where, `câu ${q.id} thiếu đề`);
  if (!Array.isArray(q.choices) || q.choices.length < 3) err(where, `câu ${q.id} phải có ít nhất 3 lựa chọn`);
  else {
    if (new Set(q.choices).size !== q.choices.length) err(where, `câu ${q.id} có lựa chọn trùng nhau`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) {
      err(where, `câu ${q.id} có chỉ số đáp án ngoài khoảng`);
    }
  }
  if (!q.why && !q.why_vi) warn(where, `câu ${q.id} chưa có giải thích`);
}

function checkDrill(d, where) {
  if (!d.id) err(where, 'tình huống thiếu id');
  if (!d.target) err(where, `tình huống ${d.id} thiếu câu mẫu (target)`);
  if (!Array.isArray(d.keys)) err(where, `tình huống ${d.id} thiếu mảng keys`);
  else {
    const t = String(d.target || '').toLowerCase();
    d.keys.forEach((k) => {
      if (!t.includes(String(k).toLowerCase())) {
        err(where, `tình huống ${d.id}: cụm khoá "${k}" không nằm trong câu mẫu, sẽ không bao giờ chấm được điểm tối đa`);
      }
    });
  }
}

const manifest = await readJSON('data/manifest.json');
if (!manifest) {
  console.error('Không đọc được manifest, dừng.');
  process.exit(1);
}

let cardTotal = 0;
let qTotal = 0;
let drillTotal = 0;

for (const deck of manifest.decks || []) {
  const file = await readJSON(deck.file);
  if (!file) continue;
  if (file.id !== deck.id) err(deck.file, `id trong file (${file.id}) khác id trong manifest (${deck.id})`);
  const cards = file.cards || [];
  if (!cards.length) err(deck.file, 'bộ thẻ rỗng');
  cards.forEach((c) => checkCard(c, deck.file, deck.lang));
  cardTotal += cards.length;
}

for (const quiz of manifest.quizzes || []) {
  if (!(manifest.decks || []).some((d) => d.id === quiz.deck)) {
    err('data/manifest.json', `ngân hàng câu hỏi ${quiz.id} trỏ tới bộ thẻ "${quiz.deck}" không tồn tại`);
  }
  const file = await readJSON(quiz.file);
  if (!file) continue;
  const qs = file.questions || [];
  qs.forEach((q) => checkQuestion(q, quiz.file));
  qTotal += qs.length;
}

for (const set of manifest.speaking || []) {
  const file = await readJSON(set.file);
  if (!file) continue;
  const drills = file.drills || [];
  if (!drills.length) err(set.file, 'bộ luyện nói rỗng');
  drills.forEach((d) => checkDrill(d, set.file));
  drillTotal += drills.length;
}

console.log(`\nĐã kiểm: ${manifest.decks?.length || 0} bộ thẻ · ${cardTotal} thẻ · ${qTotal} câu hỏi · ${drillTotal} tình huống nói\n`);

if (warnings.length) {
  console.log(`Cảnh báo (${warnings.length}):`);
  warnings.slice(0, 40).forEach((w) => console.log('  ! ' + w));
  if (warnings.length > 40) console.log(`  … còn ${warnings.length - 40} cảnh báo nữa`);
  console.log('');
}

if (errors.length) {
  console.error(`LỖI (${errors.length}):`);
  errors.forEach((e) => console.error('  x ' + e));
  console.error('\nKhông đạt. Sửa xong hãy chạy lại.\n');
  process.exit(1);
}

console.log('Đạt. Dữ liệu dùng được.\n');
