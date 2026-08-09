// Bo dinh tuyen theo hash. Trang tinh hoan toan, khong build, khong API.

import { getManifest } from './data.js';
import { getTheme, setTheme, getPlan } from './store.js';
import { initPWA } from './pwa.js';
import { renderHome } from './views/home.js';
import { renderToday } from './views/today.js';
import { renderPlan } from './views/plan.js';
import { renderDeck } from './views/deck.js';
import { renderLearn } from './views/learn.js';
import { renderQuiz } from './views/quizview.js';
import { renderSpeak, renderSay } from './views/speak.js';
import { renderBrowse } from './views/browse.js';
import { renderStats } from './views/stats.js';
import { stopSpeaking } from './speech.js';

const app = document.getElementById('app');

/* ---------- Nen sang toi ---------- */

function applyTheme(v) {
  document.documentElement.dataset.theme = v;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', v === 'light' ? '#eef5ea' : '#0a1512');
}

const saved = getTheme();
// Mac dinh la nen sang, vi do la dien mao chinh cua bang mau nay.
// Bam nut doi thi lua chon duoc nho lai cho lan sau.
applyTheme(saved || 'light');

document.getElementById('theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  setTheme(next);
});

/* ---------- Dinh tuyen ---------- */

/* Phan tu thu tu la KIEU BO CUC, khong phai muc dieu huong.
   'study' la nhung man dang hoc: the lat, cau hoi, bai noi. Chung phai nam trong
   mot cot doc hep, vi tren man hinh rong mot the cao ba tram diem anh keo ngang
   hon mot nghin diem anh thi mat phai quet qua xa va chu tu thanh loang.
   'wide' la nhung man tra cuu va tong hop, cang rong cang tot. */
const ROUTES = [
  [/^\/?$/, () => renderHome(app), 'home', 'wide'],
  // #/start la cua vao khi mo ung dung da cai. No ton trong lua chon "vao thang
  // the dau tien". #/today thi luon chay chuoi, vi do la nut nguoi hoc tu bam.
  [/^\/start$/, () => (getPlan().autostart ? renderToday(app) : renderPlan(app)), 'today', 'study'],
  [/^\/today$/, () => renderToday(app), 'today', 'study'],
  [/^\/plan$/, () => renderPlan(app), 'today', 'wide'],
  [/^\/deck\/([\w-]+)$/, (m) => renderDeck(app, m[1]), 'home', 'wide'],
  [/^\/learn\/([\w-]+)$/, (m) => renderLearn(app, m[1]), 'home', 'study'],
  [/^\/quiz\/([\w-]+)$/, (m) => renderQuiz(app, m[1]), 'home', 'study'],
  [/^\/say\/([\w-]+)$/, (m) => renderSay(app, m[1]), 'home', 'study'],
  [/^\/speak\/([\w-]+)$/, (m) => renderSpeak(app, m[1]), 'home', 'study'],
  [/^\/browse\/([\w-]+)$/, (m) => renderBrowse(app, m[1]), 'browse', 'wide'],
  [/^\/browse$/, () => renderBrowse(app, null), 'browse', 'wide'],
  [/^\/stats$/, () => renderStats(app), 'stats', 'wide']
];

function markNav(name) {
  document.querySelectorAll('.topnav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === name);
  });
}

async function route() {
  // Don dep trang truoc: go phim tat, tat mic, tat giong doc.
  app._cleanup?.();
  app._cleanup = null;
  stopSpeaking();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

  const path = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  const hit = ROUTES.find(([re]) => re.test(path));

  if (!hit) {
    app.innerHTML = `<div class="empty">Không có trang <code>${path}</code>. <a href="#/">Về trang chính</a>.</div>`;
    markNav('');
    return;
  }

  markNav(hit[2]);
  app.dataset.layout = hit[3] || 'wide';
  app.innerHTML = '<div class="loading">Đang tải…</div>';
  try {
    await hit[1](path.match(hit[0]));
  } catch (err) {
    console.error(err);
    app.innerHTML = `
      <div class="empty">
        <p><strong>Không tải được dữ liệu.</strong></p>
        <p>${err.message}</p>
        <p style="font-size:13px">Nếu bạn đang mở file trực tiếp bằng <code>file://</code> thì trình duyệt chặn <code>fetch</code>. Hãy chạy một máy chủ tĩnh, ví dụ <code>npx serve</code>, rồi mở qua <code>http://localhost</code>.</p>
      </div>`;
  }
}

/* ---------- Dau phien ban ----------
   In ngay chan trang de nhin mot cai la biet dang o ban nao. Truoc day khong co
   cach nao phan biet ban moi voi ban trinh duyet con giu trong bo dem. */

getManifest()
  .then((m) => {
    const el = document.getElementById('ver');
    if (!el || !m.updated) return;
    const [y, mo, d] = String(m.updated).split('-');
    const nDeck = (m.decks || []).length;
    const nSpeak = (m.speaking || []).length;
    const build = document.querySelector('meta[name="build"]')?.content || '';
    el.textContent = `Dữ liệu ${d}/${mo}/${y} · ${nDeck} bộ thẻ · ${nSpeak} bộ luyện nói${build ? ` · bản ${build}` : ''}`;
  })
  .catch(() => { /* chan trang khong quan trong den muc lam hong trang */ });

window.addEventListener('hashchange', route);
route();
initPWA();
