// Trang chuoi hom nay: xem tien do, bat dau chuoi, va sua ke hoach.
// Ca phan cai len dien thoai va phan tai truoc du lieu de hoc ngoai tuyen deu o day.

import { getManifest } from '../data.js';
import { getPlan, setPlan, resetPlan, streak } from '../store.js';
import { todayProgress, planStages } from './today.js';
import { esc } from '../ui.js';
import { canInstall, promptInstall, isStandalone, isIOS, onInstallChange, downloadAll } from '../pwa.js';

const CARD_CHOICES = [0, 5, 10, 15, 20, 30, 40, 60];
const QUIZ_CHOICES = [0, 5, 10, 15, 20, 30];
const SPEAK_CHOICES = [0, 3, 5, 8, 12, 20];

function numOptions(list, current) {
  return list.map((n) => `<option value="${n}"${n === current ? ' selected' : ''}>${n === 0 ? 'bỏ chặng này' : n}</option>`).join('');
}

export async function renderPlan(app) {
  // Trang nay tu ve lai chinh no moi lan doi ke hoach. Phai go nguoi theo doi cu
  // truoc, neu khong moi lan doi mot o chon la them mot nguoi theo doi song mai.
  app._cleanup?.();
  app._cleanup = null;

  const manifest = await getManifest();
  const plan = getPlan();
  const prog = todayProgress(plan);
  const stages = planStages(plan);
  const days = streak();
  const groups = manifest.groups || [{ id: 'domain', title: 'Bộ thẻ' }];
  const chosen = new Set(plan.decks);
  const allDecks = plan.decks.length === 0;

  const deckChip = (d) => `
    <label class="chip ${allDecks || chosen.has(d.id) ? 'is-on' : ''}">
      <input type="checkbox" class="deck-pick" value="${esc(d.id)}" ${allDecks || chosen.has(d.id) ? 'checked' : ''}>
      <span>${esc(d.icon || '📘')} ${esc(d.title)}</span>
    </label>`;

  app.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">${days > 0 ? `${days} ngày liên tiếp` : 'chưa có chuỗi ngày nào'}</div>
      <h1>Chuỗi hôm nay</h1>
      <p>Một lượt học liền mạch: lật thẻ, rồi trắc nghiệm ngay trên những thẻ vừa lật, rồi nói thành tiếng. Mở ứng dụng là vào thẳng chặng đầu.</p>
    </div>

    <div class="chain-hero card">
      <div class="chain-hero-steps">
        ${stages.length
          ? stages.map((s) => `
            <span class="chain-step">${esc(s.icon)} ${esc(s.name)} <b>${plan[s.key]}</b></span>`)
            .join('<i class="chain-sep" aria-hidden="true">›</i>')
          : '<span class="chain-step">Chưa bật chặng nào</span>'}
      </div>
      <div class="chain-prog">
        ${prog.rows.map((r) => `
          <div class="chain-prog-row">
            <span>${esc(r.label)}</span>
            <span class="chain-prog-bar"><i style="width:${Math.min(100, Math.round((r.done / r.goal) * 100))}%"></i></span>
            <span class="chain-prog-num">${r.done}/${r.goal}</span>
          </div>`).join('')}
      </div>
      <div class="btn-row">
        <a class="btn btn-primary btn-big" href="#/today">${prog.allDone ? 'Học thêm một chuỗi nữa' : 'Bắt đầu chuỗi'}</a>
        ${prog.allDone ? '<span class="pill pill-ok">hôm nay đã xong</span>' : ''}
      </div>
    </div>

    <div class="section-title">Cài lên điện thoại</div>
    <div class="card install-card" id="install-card">${installBlock()}</div>

    <div class="section-title">Sửa chuỗi</div>
    <div class="card plan-card">
      <div class="plan-grid">
        <label class="field">
          <span>Số thẻ khái niệm</span>
          <span class="sel-wrap"><select id="p-cards">${numOptions(CARD_CHOICES, plan.cards)}</select></span>
        </label>
        <label class="field">
          <span>Số câu trắc nghiệm</span>
          <span class="sel-wrap"><select id="p-quiz">${numOptions(QUIZ_CHOICES, plan.quiz)}</select></span>
        </label>
        <label class="field">
          <span>Số lượt nói</span>
          <span class="sel-wrap"><select id="p-speak">${numOptions(SPEAK_CHOICES, plan.speak)}</select></span>
        </label>
        <label class="field">
          <span>Bộ luyện nói</span>
          <span class="sel-wrap"><select id="p-set">
            <option value="auto"${plan.speakSet === 'auto' ? ' selected' : ''}>xoay vòng theo ngày</option>
            ${(manifest.speaking || []).map((s) => `<option value="${esc(s.id)}"${plan.speakSet === s.id ? ' selected' : ''}>${esc(s.title)}</option>`).join('')}
          </select></span>
        </label>
      </div>

      <label class="switch">
        <input type="checkbox" id="p-auto" ${plan.autostart ? 'checked' : ''}>
        <span>Mở ứng dụng là vào thẳng thẻ đầu tiên, không dừng ở trang này</span>
      </label>

      <div class="plan-decks">
        <div class="plan-decks-head">
          <strong>Lấy thẻ từ những bộ nào</strong>
          <span class="btn-row">
            <button class="btn btn-sm" id="p-all">Chọn hết</button>
            <button class="btn btn-sm" id="p-none">Bỏ hết</button>
          </span>
        </div>
        ${groups.map((g) => {
          const items = manifest.decks.filter((d) => (d.group || 'domain') === g.id);
          if (!items.length) return '';
          return `<div class="plan-group"><div class="plan-group-title">${esc(g.title)}</div>
            <div class="chips">${items.map(deckChip).join('')}</div></div>`;
        }).join('')}
        <p class="flash-hint" id="deck-note"></p>
      </div>

      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" id="p-reset">Về mặc định</button>
      </div>
    </div>

    <div class="section-title">Học khi không có mạng</div>
    <div class="card">
      <p style="margin:0 0 12px">Tải sẵn toàn bộ thẻ, câu hỏi và bài nói vào máy. Sau đó vẫn học được khi bay, khi mất sóng, khi không muốn tốn dữ liệu di động.</p>
      <div class="btn-row">
        <button class="btn" id="btn-offline">Tải toàn bộ dữ liệu</button>
        <span class="flash-hint" id="offline-state">Khoảng ${estimateMB(manifest)} MB.</span>
      </div>
    </div>
  `;

  /* ---------- Cai len dien thoai ---------- */

  function installBlock() {
    if (isStandalone()) {
      return `<p style="margin:0"><strong>Đã cài rồi.</strong> Bạn đang mở bản đã cài chứ không phải trong tab trình duyệt. Biểu tượng nằm trên màn hình chính, mở lên là vào thẳng chuỗi học.</p>`;
    }
    if (canInstall()) {
      return `
        <p style="margin:0 0 12px">Cài xong thì có biểu tượng riêng trên màn hình chính, mở toàn màn hình, không thanh địa chỉ, và học được cả khi mất mạng.</p>
        <div class="btn-row"><button class="btn btn-primary" id="btn-install">Cài lên máy</button></div>`;
    }
    if (isIOS()) {
      return `
        <p style="margin:0 0 10px">Trên iPhone và iPad, Safari không có nút cài. Làm tay ba bước:</p>
        <ol class="steps">
          <li>Mở trang này bằng <strong>Safari</strong>, không phải Chrome.</li>
          <li>Bấm nút <strong>Chia sẻ</strong>, hình vuông có mũi tên đi lên.</li>
          <li>Kéo xuống chọn <strong>Thêm vào màn hình chính</strong>.</li>
        </ol>`;
    }
    return `
      <p style="margin:0 0 10px">Trình duyệt này chưa gửi lời mời cài. Thường là vì một trong bốn lẽ:</p>
      <ol class="steps">
        <li>Lời mời tới chậm vài giây sau khi mở trang. Nút sẽ tự hiện ra ở đây, không cần tải lại.</li>
        <li>Máy đã cài rồi, nên không mời nữa.</li>
        <li>Trang chưa mở qua <strong>https</strong>.</li>
        <li>Trình duyệt cần bạn tự bấm: menu ba chấm, rồi <strong>Cài ứng dụng</strong> hoặc <strong>Thêm vào màn hình chính</strong>. Firefox và Chrome trên máy tính thường nằm ở đây.</li>
      </ol>`;
  }

  function bindInstall() {
    app.querySelector('#btn-install')?.addEventListener('click', async () => {
      const outcome = await promptInstall();
      const box = app.querySelector('#install-card');
      if (box && outcome === 'accepted') {
        box.innerHTML = `<p style="margin:0"><strong>Đang cài.</strong> Biểu tượng sẽ hiện trên màn hình chính sau một lát.</p>`;
      } else if (box && outcome === 'dismissed') {
        box.innerHTML = installBlock();
        bindInstall();
      }
    });
  }
  bindInstall();

  const offInstall = onInstallChange(() => {
    const box = app.querySelector('#install-card');
    if (!box) return;
    box.innerHTML = installBlock();
    bindInstall();
  });

  /* ---------- Sua ke hoach ---------- */

  const num = (id) => Number(app.querySelector(id).value);
  const rerender = () => renderPlan(app);

  app.querySelector('#p-cards').addEventListener('change', () => { setPlan({ cards: num('#p-cards') }); rerender(); });
  app.querySelector('#p-quiz').addEventListener('change', () => { setPlan({ quiz: num('#p-quiz') }); rerender(); });
  app.querySelector('#p-speak').addEventListener('change', () => { setPlan({ speak: num('#p-speak') }); rerender(); });
  app.querySelector('#p-set').addEventListener('change', (e) => setPlan({ speakSet: e.target.value }));
  app.querySelector('#p-auto').addEventListener('change', (e) => setPlan({ autostart: e.target.checked }));
  app.querySelector('#p-reset').addEventListener('click', () => { resetPlan(); rerender(); });

  const picks = [...app.querySelectorAll('.deck-pick')];

  function saveDecks() {
    const on = picks.filter((p) => p.checked).map((p) => p.value);
    // Chon het bang khong chon rieng bo nao: luu danh sach rong de sau nay them
    // bo the moi vao manifest thi chuoi tu dong lay ca bo do, khong phai vao sua.
    setPlan({ decks: on.length === picks.length ? [] : on });
    picks.forEach((p) => p.closest('.chip').classList.toggle('is-on', p.checked));
    const note = app.querySelector('#deck-note');
    const n = on.length;
    if (note) {
      note.textContent = n === picks.length
        ? 'Đang lấy từ tất cả các bộ. Thêm bộ mới vào JSON là chuỗi tự lấy luôn.'
        : n === 0
          ? 'Chưa chọn bộ nào, chuỗi sẽ tự lấy hết để bạn vẫn có bài.'
          : `Đang lấy từ ${n} bộ.`;
    }
  }
  picks.forEach((p) => p.addEventListener('change', saveDecks));
  app.querySelector('#p-all').addEventListener('click', () => { picks.forEach((p) => { p.checked = true; }); saveDecks(); });
  app.querySelector('#p-none').addEventListener('click', () => { picks.forEach((p) => { p.checked = false; }); saveDecks(); });
  saveDecks();

  /* ---------- Tai truoc ---------- */

  app.querySelector('#btn-offline').addEventListener('click', async () => {
    const btn = app.querySelector('#btn-offline');
    const state = app.querySelector('#offline-state');
    const urls = dataURLs(manifest);
    btn.disabled = true;
    state.textContent = `Đang tải 0/${urls.length}…`;
    const r = await downloadAll(urls, ({ done, total }) => {
      state.textContent = `Đang tải ${done}/${total}…`;
    });
    btn.disabled = false;
    state.textContent = r.viaWorker
      ? `Đã lưu ${r.ok}/${r.total} tệp vào máy. Giờ học được khi không có mạng.`
      : `Đã tải ${r.ok ?? r.total}/${r.total} tệp, nhưng máy này chưa chạy được service worker nên bản lưu có thể bị trình duyệt dọn.`;
  });

  app._cleanup = () => offInstall();
}

function dataURLs(manifest) {
  const out = ['data/manifest.json'];
  for (const d of manifest.decks || []) out.push(d.file);
  for (const q of manifest.quizzes || []) out.push(q.file);
  for (const s of manifest.speaking || []) out.push(s.file);
  return [...new Set(out)];
}

/** Uoc luong tho, chi de nguoi dung biet co nen bam khi dang dung mang di dong. */
function estimateMB(manifest) {
  const n = dataURLs(manifest).length;
  return Math.max(1, Math.round(n * 0.105 * 10) / 10);
}
