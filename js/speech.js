// Doc va nghe hoan toan bang API san co cua trinh duyet. Khong goi dich vu nao ben ngoai.

/* ---------- Doc thanh tieng ---------- */

let voicesReady = false;

function ensureVoices() {
  if (voicesReady || !('speechSynthesis' in window)) return;
  window.speechSynthesis.getVoices();
  voicesReady = true;
}

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text, { lang = 'en-US', rate = 0.95 } = {}) {
  if (!canSpeak() || !text) return;
  ensureVoices();
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const match = window.speechSynthesis.getVoices().find((v) => v.lang && v.lang.replace('_', '-').startsWith(lang.slice(0, 2)));
  if (match) u.voice = match;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/* ---------- Nghe giong noi ---------- */

const Recognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

export function canListen() {
  return Boolean(Recognition);
}

/**
 * Bat mic mot luot. onResult nhan ban ghi tam thoi lan cuoi cung.
 * Tra ve ham dung lai.
 */
export function listenOnce({ lang = 'en-US', onResult, onEnd, onError }) {
  if (!Recognition) {
    onError?.(new Error('Trình duyệt này không có nhận dạng giọng nói.'));
    return () => {};
  }
  const rec = new Recognition();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let finalText = '';
  rec.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
      const r = ev.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    onResult?.((finalText + ' ' + interim).trim(), Boolean(finalText));
  };
  rec.onerror = (ev) => onError?.(new Error(ev.error || 'Lỗi nhận dạng giọng nói.'));
  rec.onend = () => onEnd?.(finalText.trim());

  try {
    rec.start();
  } catch (err) {
    onError?.(err);
  }
  return () => {
    try { rec.stop(); } catch { /* da dung roi */ }
  };
}

/* ---------- Cham diem tat dinh ---------- */

const STOP = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'i', 'you', 'we', 'they',
  'it', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'but', 'that', 'this', 'so', 'as',
  'my', 'your', 'our', 'their', 'me', 'us', 'them', 'do', 'does', 'did', 'have', 'has', 'had',
  'will', 'would', 'can', 'could', 'with', 'from', 'by', 'not', 'there', 'here', 'about'
]);

export function tokenise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function contentWords(text) {
  return tokenise(text).filter((w) => !STOP.has(w) && w.length > 2);
}

/**
 * Cham mot luot noi. Diem gom hai phan:
 *  - phu cum khoa (keys), tinh theo chuoi con da chuan hoa
 *  - phu tu noi dung cua cau mau
 * Hoan toan tat dinh, khong nho mo hinh nao.
 */
export function scoreSpoken(said, target, keys = []) {
  const saidNorm = ' ' + tokenise(said).join(' ') + ' ';
  const keyHits = keys.map((k) => ({
    key: k,
    hit: saidNorm.includes(' ' + tokenise(k).join(' ') + ' ')
  }));

  const targetWords = contentWords(target);
  const saidSet = new Set(tokenise(said));
  const covered = targetWords.filter((w) => saidSet.has(w));
  const coverage = targetWords.length ? covered.length / targetWords.length : 0;
  const keyRatio = keys.length ? keyHits.filter((k) => k.hit).length / keys.length : 1;

  const words = tokenise(said).length;
  const lengthOk = words >= Math.max(4, Math.round(targetWords.length * 0.4));

  let score = Math.round((keyRatio * 0.55 + coverage * 0.45) * 100);
  if (!lengthOk) score = Math.round(score * 0.6);
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    keyHits,
    coverage: Math.round(coverage * 100),
    words,
    missing: targetWords.filter((w) => !saidSet.has(w)).slice(0, 8)
  };
}
