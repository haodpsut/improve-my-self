// Bo dinh tuyen theo hash. Trang tinh hoan toan, khong build, khong API.

import { getTheme, setTheme } from './store.js';
import { renderHome } from './views/home.js';
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
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', v === 'light' ? '#f5f7fc' : '#070b16');
}

const saved = getTheme();
applyTheme(saved || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

document.getElementById('theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  setTheme(next);
});

/* ---------- Dinh tuyen ---------- */

const ROUTES = [
  [/^\/?$/, () => renderHome(app), 'home'],
  [/^\/deck\/([\w-]+)$/, (m) => renderDeck(app, m[1]), 'home'],
  [/^\/learn\/([\w-]+)$/, (m) => renderLearn(app, m[1]), 'home'],
  [/^\/quiz\/([\w-]+)$/, (m) => renderQuiz(app, m[1]), 'home'],
  [/^\/say\/([\w-]+)$/, (m) => renderSay(app, m[1]), 'home'],
  [/^\/speak\/([\w-]+)$/, (m) => renderSpeak(app, m[1]), 'home'],
  [/^\/browse\/([\w-]+)$/, (m) => renderBrowse(app, m[1]), 'browse'],
  [/^\/browse$/, () => renderBrowse(app, null), 'browse'],
  [/^\/stats$/, () => renderStats(app), 'stats']
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

window.addEventListener('hashchange', route);
route();
