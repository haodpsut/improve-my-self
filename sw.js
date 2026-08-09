/* Service worker cua Improve my self.
   Muc dich duy nhat: cai duoc len man hinh chinh va hoc duoc khi khong co mang.
   Khong doi du lieu ra ngoai, khong goi API nao.

   Ba loai tep, ba cach xu ly khac nhau, va ly do cua tung cach:

   1. Vo trang (html, css, js): LAY MANG TRUOC, ban luu chi la du phong. Vo trang
      rat nhe, nen tai lai moi lan cung khong dang ke, doi lai la khong bao gio
      chay nham ma nguon cu. Day la loai loi rat kho nhin ra: trang van chay,
      chi la chay bang ban cua hom qua.
   2. data/manifest.json: cung LAY MANG TRUOC, vi no la moc de biet bo du lieu
      da doi ngay hay chua.
   3. Cac tep du lieu con lai: LAY BAN LUU TRUOC, vi chung nang tong cong hon nam
      megabyte. Ban luu bi xoa khi truong updated trong manifest doi sang ngay
      moi, nen van khong the mac ket o du lieu cu. */

const VERSION = 'v3';
const SHELL_CACHE = `ims-shell-${VERSION}`;
const DATA_CACHE = 'ims-data';
const FONT_CACHE = 'ims-font';
const STAMP_URL = './__ims-data-stamp';
const NET_TIMEOUT = 4500;

const SHELL = [
  './',
  'css/app.css',
  'js/app.js',
  'js/data.js',
  'js/store.js',
  'js/ui.js',
  'js/quiz.js',
  'js/speech.js',
  'js/pwa.js',
  'js/views/home.js',
  'js/views/deck.js',
  'js/views/learn.js',
  'js/views/quizview.js',
  'js/views/speak.js',
  'js/views/browse.js',
  'js/views/stats.js',
  'js/views/today.js',
  'js/views/plan.js',
  'assets/logo.svg',
  'assets/favicon.svg',
  'assets/icon-180.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
  'site.webmanifest',
  'data/manifest.json'
];

/* ---------- Vong doi ---------- */

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Tung tep mot, vi addAll that bai toan bo chi vi mot tep loi, va khi do
    // nguoi dung mat luon kha nang dung ngoai tuyen ma khong hieu tai sao.
    await Promise.all(SHELL.map(async (u) => {
      try {
        const res = await fetch(u, { cache: 'reload' });
        if (res.ok) await cache.put(u, res);
      } catch (err) {
        console.warn('[sw] không tải trước được', u, err.message);
      }
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => n.startsWith('ims-shell-') && n !== SHELL_CACHE)
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/* ---------- Tin nhan tu trang ---------- */

self.addEventListener('message', (event) => {
  const msg = event.data || {};

  if (msg.type === 'skip-waiting') {
    self.skipWaiting();
    return;
  }

  if (msg.type === 'precache-all') {
    const port = event.ports?.[0];
    event.waitUntil(precacheAll(msg.urls || [], port));
  }
});

/**
 * Lay manifest tu mang, va nhan tien doi chieu ngay cua bo du lieu.
 *
 * Viec doi chieu PHAI lam ngay tai day chu khong phai bang mot tin nhan tu trang
 * gui sang. Trang goi manifest xong moi goi tep the dau tien, nen neu xoa ban luu
 * ngay trong lan tra manifest nay thi khong the co chuyen mot tep the cu kip lot
 * ra truoc khi ban luu bi don. Neu de trang gui tin nhan thi hai viec do chay
 * song song, va co that mot khe hep de du lieu hom qua di lot.
 */
async function handleManifest(req) {
  const cache = await caches.open(DATA_CACHE);
  let res;
  try {
    res = await timedFetch(req, NET_TIMEOUT);
  } catch {
    const hit = await cache.match(req);
    return hit || new Response('Đang không có mạng và chưa có bản lưu của manifest.', {
      status: 504,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
  if (!res.ok) return res;

  let stamp = null;
  try {
    stamp = (await res.clone().json()).updated || null;
  } catch { /* manifest hong thi khong doi chieu, cu tra ve nguyen trang */ }

  if (stamp) {
    const prev = await cache.match(STAMP_URL);
    const prevText = prev ? await prev.text() : null;
    if (prevText !== stamp) {
      await caches.delete(DATA_CACHE);
      const fresh = await caches.open(DATA_CACHE);
      await fresh.put(STAMP_URL, new Response(stamp));
      await fresh.put(req, res.clone());
      return res;
    }
  }
  cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function precacheAll(urls, port) {
  const cache = await caches.open(DATA_CACHE);
  let done = 0;
  let ok = 0;
  const CHUNK = 6;
  for (let i = 0; i < urls.length; i += CHUNK) {
    const slice = urls.slice(i, i + CHUNK);
    await Promise.all(slice.map(async (u) => {
      try {
        const res = await fetch(u, { cache: 'reload' });
        if (res.ok) { await cache.put(u, res); ok += 1; }
      } catch { /* tep nao hong thi bo qua, khong lam hong ca me */ }
      done += 1;
      port?.postMessage({ type: 'precache-progress', done, total: urls.length });
    }));
  }
  port?.postMessage({ type: 'precache-done', ok, total: urls.length });
}

/* ---------- Lay tep ---------- */

function timedFetch(req, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  // Yeu cau kieu navigate khong sao chep kem signal duoc, nen phai lay lai url.
  const target = req.mode === 'navigate' ? new Request(req.url, { headers: req.headers }) : req;
  return fetch(target, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await timedFetch(req, NET_TIMEOUT);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    const hit = await cache.match(req) || await caches.match(req);
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = await caches.match('./');
      if (shell) return shell;
    }
    return new Response('Đang không có mạng và chưa có bản lưu của tệp này.', {
      status: 504,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    return new Response('Đang không có mạng và chưa có bản lưu của tệp này.', {
      status: 504,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin !== location.origin) {
    // Chi phong chu. Tep phong co ma bam trong duong dan nen khong bao gio doi
    // noi dung duoi cung mot duong dan, lay ban luu truoc la an toan.
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      event.respondWith(cacheFirst(req, FONT_CACHE));
    }
    return;
  }

  if (url.pathname.endsWith('/data/manifest.json')) {
    event.respondWith(handleManifest(req));
    return;
  }

  if (url.pathname.includes('/data/')) {
    event.respondWith(cacheFirst(req, DATA_CACHE));
    return;
  }

  event.respondWith(networkFirst(req, SHELL_CACHE));
});
