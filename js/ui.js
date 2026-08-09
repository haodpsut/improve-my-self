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

/**
 * Thanh chang cua chuoi hoc hang ngay. Dat ngay dau moi man trong chuoi de luc
 * nao cung nhin thay dang o chang may va con may chang nua.
 */
export function chainBar(chain) {
  if (!chain) return '';
  const steps = chain.stages.map((s, i) => {
    const n = i + 1;
    const cls = n === chain.step ? 'is-now' : n < chain.step ? 'is-done' : '';
    return `<span class="chain-step ${cls}"><b>${esc(s.icon)}</b> ${esc(s.name)}</span>`;
  });
  return `
    <div class="chain-bar">
      ${steps.join('<i class="chain-sep" aria-hidden="true">›</i>')}
      <span class="spacer"></span>
      <a class="btn btn-sm btn-ghost" href="#/plan">Dừng</a>
    </div>`;
}

export function emptyState(text) {
  return `<div class="empty">${esc(text)}</div>`;
}

/**
 * O chon co luot hoc, dat ngay tren thanh phien.
 * Day la cho nguoi dung hay hieu nham rang bo chi co bay nhieu the,
 * nen luon in kem tong so co that trong bo.
 */
export function sizePicker(current, choices, total, unit) {
  // Neu gia tri dang chay khong nam trong danh sach thi chen no vao, neu khong
  // trinh duyet se chon muc dau tien va o chon se noi sai cai dang thuc chay.
  const list = choices.includes(current) ? choices : [...choices, current].sort((a, b) => a - b);
  const opts = list.map((n) => {
    const label = n === 0 ? `tất cả ${total}` : `${n}`;
    const disabled = n !== 0 && n > total ? ' disabled' : '';
    return `<option value="${n}"${n === current ? ' selected' : ''}${disabled}>${label}</option>`;
  }).join('');
  // Tach phan duoi ra mot the rieng de o be ngang dien thoai chi giau phan duoi,
  // van giu lai con so tong. Giau ca cum thi quay lai dung cai hieu nham cu:
  // "bo co hon nam nghin cau ma sao chi lam co muoi cau".
  return `
    <label class="size-pick">
      <span>mỗi lượt</span>
      <span class="sel-wrap"><select id="size-sel">${opts}</select></span>
      <span class="size-total">trong tổng ${total} <span class="size-tail">${esc(unit)}</span></span>
    </label>`;
}

export function fmtDate(iso) {
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
}
