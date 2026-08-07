// Vai tien ich nho dung chung cho moi trang.

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function html(strings, ...values) {
  return strings.reduce((acc, s, i) => acc + s + (i < values.length ? values[i] : ''), '');
}

export function mount(node, markup) {
  node.innerHTML = markup;
  return node;
}

export function on(root, selector, event, handler) {
  root.querySelectorAll(selector).forEach((el) => el.addEventListener(event, handler));
}

export function crumb(parts) {
  const items = parts.map((p, i) => {
    const last = i === parts.length - 1;
    if (last || !p.href) return `<span>${esc(p.label)}</span>`;
    return `<a href="${p.href}">${esc(p.label)}</a><span>›</span>`;
  });
  return `<div class="crumb">${items.join(' ')}</div>`;
}

export function progressBar(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<div class="progress"><i style="width:${pct}%"></i></div>`;
}

export function scoreRing(pct) {
  const colour = pct >= 75 ? 'var(--ok)' : pct >= 45 ? 'var(--warn)' : 'var(--bad)';
  return `<div class="score-ring" style="--pct:${pct};--ring-color:${colour}"><span>${pct}</span></div>`;
}

export function emptyState(text) {
  return `<div class="empty">${esc(text)}</div>`;
}

export function fmtDate(iso) {
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
}
