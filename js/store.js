// Tien do hoc luu ngay tren may, khong co backend.
// Lich lap ngat quang kieu Leitner: moi the co mot hop, hop cang cao thi cach cang xa.

const KEY = 'ims.v1';
const BOX_DAYS = [0, 1, 2, 4, 8, 16, 32];

function blank() {
  return { cards: {}, quiz: {}, speak: {}, days: {}, theme: null, prefs: {} };
}

// Co mot luot hoc. Khong phai so the trong bo, ma la so the lay ra moi lan.
const DEFAULT_SIZE = { learn: 20, quiz: 12, speak: 12 };
export const SIZE_CHOICES = [10, 20, 30, 50, 0]; // 0 nghia la lay het

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const parsed = JSON.parse(raw);
    return { ...blank(), ...parsed };
  } catch {
    return blank();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Không ghi được tiến độ vào localStorage:', err);
  }
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bumpDay(field) {
  const t = today();
  if (!state.days[t]) state.days[t] = { learn: 0, quiz: 0, speak: 0 };
  state.days[t][field] = (state.days[t][field] || 0) + 1;
}

/* ---------- The ghi nho ---------- */

export function cardState(cardId) {
  return state.cards[cardId] || { box: 0, due: '1970-01-01', seen: 0, right: 0, wrong: 0 };
}

export function isDue(cardId) {
  return cardState(cardId).due <= today();
}

/** grade: 'again' | 'hard' | 'good' */
export function gradeCard(cardId, grade) {
  const cur = cardState(cardId);
  let box = cur.box;
  if (grade === 'good') box = Math.min(box + 1, BOX_DAYS.length - 1);
  else if (grade === 'hard') box = Math.max(1, box);
  else box = 0;

  state.cards[cardId] = {
    box,
    due: addDays(BOX_DAYS[box] || 0),
    seen: cur.seen + 1,
    right: cur.right + (grade === 'good' ? 1 : 0),
    wrong: cur.wrong + (grade === 'again' ? 1 : 0),
    last: today()
  };
  bumpDay('learn');
  save();
}

/** Chi dem the DA hoc it nhat mot lan va nay den han on. The chua gap dem rieng. */
export function dueCount(cardIds) {
  const t = today();
  return cardIds.filter((id) => state.cards[id] && state.cards[id].due <= t).length;
}

export function newCount(cardIds) {
  return cardIds.filter((id) => !state.cards[id]).length;
}

/**
 * Xep hang doi hoc: the den han truoc, trong do the chua gap len dau,
 * roi den the hop thap. The chua den han chi bo sung khi thieu.
 */
export function buildQueue(cards, limit = 20) {
  const t = today();
  const due = [];
  const rest = [];
  for (const c of cards) {
    const s = state.cards[c.id];
    if (!s) due.push({ c, rank: 0 });
    else if (s.due <= t) due.push({ c, rank: 1 + s.box });
    else rest.push({ c, rank: 100 + s.box });
  }
  due.sort((a, b) => a.rank - b.rank);
  rest.sort((a, b) => a.rank - b.rank);
  return [...due, ...rest].slice(0, limit).map((x) => x.c);
}

/* ---------- Trac nghiem ---------- */

export function recordQuiz(deckId, right) {
  const s = state.quiz[deckId] || { asked: 0, right: 0 };
  s.asked += 1;
  if (right) s.right += 1;
  state.quiz[deckId] = s;
  bumpDay('quiz');
  save();
}

export function quizStat(deckId) {
  return state.quiz[deckId] || { asked: 0, right: 0 };
}

/* ---------- Luyen noi ---------- */

export function recordSpeak(setId, score) {
  const s = state.speak[setId] || { tries: 0, total: 0, best: 0 };
  s.tries += 1;
  s.total += score;
  s.best = Math.max(s.best, score);
  state.speak[setId] = s;
  bumpDay('speak');
  save();
}

export function speakStat(setId) {
  return state.speak[setId] || { tries: 0, total: 0, best: 0 };
}

/* ---------- Tong hop ---------- */

export function overview() {
  const cardIds = Object.keys(state.cards);
  const learned = cardIds.filter((id) => state.cards[id].box >= 3).length;
  const quiz = Object.values(state.quiz).reduce(
    (acc, s) => ({ asked: acc.asked + s.asked, right: acc.right + s.right }),
    { asked: 0, right: 0 }
  );
  const speak = Object.values(state.speak).reduce(
    (acc, s) => ({ tries: acc.tries + s.tries, total: acc.total + s.total }),
    { tries: 0, total: 0 }
  );
  return { touched: cardIds.length, learned, quiz, speak, days: state.days };
}

export function streak() {
  let n = 0;
  const d = new Date();
  for (;;) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = state.days[key];
    const active = day && (day.learn || day.quiz || day.speak);
    if (!active) {
      // Hom nay chua hoc thi chua tinh la dut chuoi, chi bo qua.
      if (n === 0 && key === today()) {
        d.setDate(d.getDate() - 1);
        continue;
      }
      break;
    }
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function lastDays(n = 14) {
  const out = [];
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i += 1) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = state.days[key] || { learn: 0, quiz: 0, speak: 0 };
    out.push({ date: key, ...day, total: day.learn + day.quiz + day.speak });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/* ---------- Co luot hoc ---------- */

/** mode: 'learn' | 'quiz' | 'speak'. Tra ve 0 khi nguoi dung chon lay het. */
export function sessionSize(mode) {
  const v = state.prefs?.[mode];
  return Number.isInteger(v) ? v : DEFAULT_SIZE[mode];
}

export function setSessionSize(mode, n) {
  state.prefs = { ...(state.prefs || {}), [mode]: n };
  save();
}

/* ---------- Nen sang toi ---------- */

export function getTheme() {
  return state.theme;
}

export function setTheme(v) {
  state.theme = v;
  save();
}

/* ---------- Sao luu ---------- */

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  state = { ...blank(), ...parsed };
  save();
}

export function reset() {
  state = blank();
  save();
}
