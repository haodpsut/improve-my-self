// Cai len man hinh chinh va chay duoc khi mat mang.
// Khong co backend, nen moi thu o day chi la mot service worker giu ban sao cua
// chinh trang nay tren may.

let deferredPrompt = null;
let registration = null;
const installWatchers = new Set();

/** Dang chay duoi dang ung dung da cai, khong phai trong tab trinh duyet. */
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true;
}

export function isIOS() {
  const ua = navigator.userAgent || '';
  // iPadOS moi tu nhan la Macintosh, nen phai xet them man hinh cam ung.
  return /iPad|iPhone|iPod/.test(ua)
    || (/Macintosh/.test(ua) && typeof document.ontouchend !== 'undefined');
}

export function isAndroid() {
  return /Android/i.test(navigator.userAgent || '');
}

export function canInstall() {
  return Boolean(deferredPrompt);
}

export function onInstallChange(cb) {
  installWatchers.add(cb);
  return () => installWatchers.delete(cb);
}

function fireInstallChange() {
  installWatchers.forEach((cb) => {
    try { cb(); } catch (err) { console.warn(err); }
  });
}

/** Tra ve 'accepted' | 'dismissed' | 'unavailable'. */
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  const ev = deferredPrompt;
  deferredPrompt = null;
  fireInstallChange();
  ev.prompt();
  const { outcome } = await ev.userChoice;
  return outcome;
}

/* ---------- Thong bao co ban moi ---------- */

let reloading = false;

function toast(message, actionLabel, onAction) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerHTML = `<span>${message}</span>`;
  if (actionLabel) {
    const b = document.createElement('button');
    b.className = 'btn btn-sm btn-primary';
    b.textContent = actionLabel;
    b.addEventListener('click', onAction);
    el.appendChild(b);
  }
  el.hidden = false;
}

function watchUpdate(reg) {
  const offer = (worker) => {
    if (!worker) return;
    // Chi moi khi da co ban dang chay. Lan cai dau tien khong phai la "ban moi",
    // bao ra thi nguoi dung se nap lai trang ngay sau khi vua mo.
    if (!navigator.serviceWorker.controller) return;
    toast('Có bản mới của trang.', 'Nạp lại', () => {
      worker.postMessage({ type: 'skip-waiting' });
    });
  };

  if (reg.waiting) offer(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => {
      if (w.state === 'installed') offer(w);
    });
  });
}

/* ---------- Dang ky ---------- */

export function initPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    fireInstallChange();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    fireInstallChange();
  });

  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      registration = reg;
      watchUpdate(reg);
    }).catch((err) => {
      // Mo bang file:// thi khong dang ky duoc, va do la binh thuong.
      console.warn('Không đăng ký được service worker:', err.message);
    });
  });
}

/* ---------- Tai truoc toan bo de hoc khi mat mang ---------- */

/**
 * Goi service worker tai het tep du lieu vao ban luu.
 * onProgress nhan { done, total }.
 */
export async function downloadAll(urls, onProgress) {
  const reg = await navigator.serviceWorker?.ready;
  if (!reg?.active) {
    // Khong co service worker thi van tai duoc, chi la ban luu nam o bo dem cua
    // trinh duyet chu khong phai ban luu rieng, va co the bi don bat cu luc nao.
    let done = 0;
    for (const u of urls) {
      try { await fetch(u, { cache: 'reload' }); } catch { /* bo qua tep loi */ }
      done += 1;
      onProgress?.({ done, total: urls.length });
    }
    return { ok: done, total: urls.length, viaWorker: false };
  }

  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => {
      const msg = e.data || {};
      if (msg.type === 'precache-progress') onProgress?.(msg);
      else if (msg.type === 'precache-done') resolve({ ...msg, viaWorker: true });
    };
    reg.active.postMessage({ type: 'precache-all', urls }, [ch.port2]);
  });
}

export function hasWorker() {
  return Boolean(registration || navigator.serviceWorker?.controller);
}
