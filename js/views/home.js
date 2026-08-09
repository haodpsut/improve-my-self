import { getManifest, loadAllDecks, loadAllSpeakingSets } from '../data.js';
import { dueCount, newCount, streak, overview, getPlan } from '../store.js';
import { todayProgress } from './today.js';
import { esc } from '../ui.js';
import { canInstall, promptInstall, isStandalone, isIOS, onInstallChange } from '../pwa.js';

export async function renderHome(app) {
  const manifest = await getManifest();
  const decks = await loadAllDecks();
  const byId = new Map(decks.map((d) => [d.deck.id, d]));
  const speakSets = await loadAllSpeakingSets();
  const drillCount = new Map(speakSets.map((s) => [s.meta.id, s.drills.length]));

  const totalCards = decks.reduce((n, d) => n + d.cards.length, 0);
  const allIds = decks.flatMap((d) => d.cards.map((c) => c.id));
  const due = dueCount(allIds);
  const fresh = newCount(allIds);
  const ov = overview();
  const days = streak();

  // Chuoi hom nay dat ngay tren cung, vi day la viec nen lam truoc moi ngay,
  // con danh sach bo the la de chon them khi con hung.
  const chainCard = () => {
    const plan = getPlan();
    const prog = todayProgress(plan);
    if (!prog.rows.length) return '';
    const line = prog.rows.map((r) => `${r.done}/${r.goal} ${r.label}`).join(' · ');
    return `
      <div class="section-title">Chuỗi hôm nay</div>
      <a class="card chain-card" href="#/today">
        <div class="mode-icon">${prog.allDone ? '✅' : '🔥'}</div>
        <div>
          <div class="mode-name">${prog.allDone ? 'Hôm nay đã xong, chạy thêm một chuỗi nữa' : 'Bắt đầu chuỗi hôm nay'}</div>
          <div class="mode-desc">${esc(line)}</div>
        </div>
        <span class="spacer"></span>
        <span class="chain-card-go" aria-hidden="true">›</span>
      </a>
      <p class="section-blurb" style="margin-top:-4px">Muốn đổi số thẻ, số câu hay chọn bộ nào thì vào <a href="#/plan">sửa chuỗi</a>.</p>`;
  };

  const groupBlock = (group) => {
    const items = manifest.decks.filter((d) => (d.group || 'domain') === group.id);
    if (!items.length) return '';
    const nCards = items.reduce((n, d) => n + (byId.get(d.id)?.cards.length || 0), 0);
    return `
      <div class="section-title">${esc(group.title)} <span class="section-count">${items.length} bộ · ${nCards} thẻ</span></div>
      ${group.blurb ? `<p class="section-blurb">${esc(group.blurb)}</p>` : ''}
      <div class="grid grid-decks">
        ${items.map((d) => deckCard(d, byId.get(d.id))).join('')}
      </div>`;
  };

  app.innerHTML = `
    <div id="install-slot"></div>
    <div class="page-head">
      <div class="eyebrow">cập nhật ${esc(manifest.updated)}</div>
      <h1>Hôm nay học gì</h1>
      <p>Mỗi bộ thẻ nuôi cả ba chế độ: học khái niệm Anh Việt, trắc nghiệm có giải thích, và luyện nói thành tiếng. Dữ liệu nằm trong JSON, thêm thẻ là trang tự có thêm bài.</p>
    </div>

    <div class="grid grid-stats" style="margin-bottom:8px">
      <div class="stat"><div class="stat-value">${due}</div><div class="stat-label">thẻ đến hạn ôn</div></div>
      <div class="stat"><div class="stat-value">${fresh}</div><div class="stat-label">thẻ chưa gặp</div></div>
      <div class="stat"><div class="stat-value">${totalCards}</div><div class="stat-label">tổng số thẻ</div></div>
      <div class="stat"><div class="stat-value">${days}</div><div class="stat-label">ngày liên tiếp</div></div>
      <div class="stat"><div class="stat-value">${ov.quiz.asked ? Math.round((ov.quiz.right / ov.quiz.asked) * 100) : 0}%</div><div class="stat-label">đúng khi trắc nghiệm</div></div>
    </div>

    ${chainCard()}

    <div class="section-title">Ôn tổng hợp</div>
    <div class="grid grid-modes">
      <a class="card mode-card" href="#/learn/all" style="--deck-color:#6ea8fe">
        <div class="mode-icon">🗓️</div>
        <div>
          <div class="mode-name">Học thẻ đến hạn của mọi bộ</div>
          <div class="mode-desc">${due > 0
            ? `${due} thẻ đang đến hạn, trộn từ mọi môn. Không phải tự chọn bộ nào.`
            : `Chưa có thẻ nào đến hạn. Lượt này sẽ lấy thẻ mới, trộn từ mọi môn.`}</div>
        </div>
      </a>
      <a class="card mode-card" href="#/quiz/all">
        <div class="mode-icon">🎲</div>
        <div>
          <div class="mode-name">Trắc nghiệm trộn mọi môn</div>
          <div class="mode-desc">Câu hỏi rút từ toàn kho, không biết trước câu tiếp theo thuộc môn nào.</div>
        </div>
      </a>
    </div>

    ${(manifest.groups || [{ id: 'domain', title: 'Bộ thẻ' }]).map(groupBlock).join('')}

    <div class="section-title">Luyện nói</div>
    <div class="grid grid-modes">
      ${(manifest.speaking || []).map((s) => `
        <a class="card mode-card" href="#/speak/${esc(s.id)}">
          <div class="mode-icon">${esc(s.icon || '🎤')}</div>
          <div>
            <div class="mode-name">${esc(s.title)}</div>
            <div class="mode-desc">${esc(s.blurb || '')}</div>
            <div class="flash-hint" style="margin-top:6px">${drillCount.get(s.id) || 0} tình huống</div>
          </div>
        </a>`).join('')}
    </div>
  `;

  /* ---------- Moi cai len may ----------
     Dat ngay dau trang chinh chu khong chi nam trong trang Hom nay. Chrome khong
     bao "cai duoc" vao dung luc trang ve xong: su kien moi cai den sau, co khi
     vai giay. Nen phai ve lai rieng o nay khi su kien den, chu ve mot lan roi
     thoi thi hau nhu luc nao cung ve nham ra "chua moi cai". */

  const slot = app.querySelector('#install-slot');

  function paintInstall() {
    if (!slot || !slot.isConnected) return;
    if (isStandalone()) { slot.innerHTML = ''; return; }

    if (canInstall()) {
      slot.innerHTML = `
        <div class="install-bar">
          <div class="install-bar-icon">📲</div>
          <div class="install-bar-text">
            <strong>Cài lên máy để học mỗi ngày</strong>
            <span>Có biểu tượng riêng, mở toàn màn hình, học được cả khi mất mạng.</span>
          </div>
          <button class="btn btn-primary" id="btn-install-home">Cài</button>
        </div>`;
      slot.querySelector('#btn-install-home').addEventListener('click', async () => {
        const outcome = await promptInstall();
        if (outcome === 'accepted') {
          slot.innerHTML = `<div class="install-bar"><div class="install-bar-icon">✅</div>
            <div class="install-bar-text"><strong>Đang cài</strong>
            <span>Biểu tượng sẽ hiện trên màn hình chính sau một lát.</span></div></div>`;
        } else {
          paintInstall();
        }
      });
      return;
    }

    if (isIOS()) {
      slot.innerHTML = `
        <div class="install-bar">
          <div class="install-bar-icon">📲</div>
          <div class="install-bar-text">
            <strong>Cài lên iPhone</strong>
            <span>Safari không có nút cài. Bấm <b>Chia sẻ</b> rồi <b>Thêm vào màn hình chính</b>.</span>
          </div>
          <a class="btn" href="#/plan">Xem cách</a>
        </div>`;
      return;
    }
    slot.innerHTML = '';
  }

  paintInstall();
  const off = onInstallChange(paintInstall);
  app._cleanup = () => off();
}

function deckCard(meta, loaded) {
  const cards = loaded ? loaded.cards : [];
  const ids = cards.map((c) => c.id);
  const due = dueCount(ids);
  const fresh = newCount(ids);
  const badge = due > 0
    ? `<span class="pill pill-due">${due} đến hạn</span>`
    : fresh === cards.length
      ? `<span class="pill">chưa bắt đầu</span>`
      : `<span class="pill pill-ok">đã ôn xong</span>`;

  return `
    <a class="card deck-card" href="#/deck/${esc(meta.id)}" style="--deck-color:${esc(meta.color || '#6ea8fe')}">
      <div class="deck-top">
        <div class="deck-icon">${esc(meta.icon || '📘')}</div>
        <div>
          <div class="deck-title">${esc(meta.title)}</div>
          <div class="flash-hint">${esc(meta.title_en || '')}</div>
        </div>
      </div>
      <div class="deck-blurb">${esc(meta.blurb || '')}</div>
      <div class="deck-foot">
        ${badge}
        <span class="dot"></span>
        <span>${cards.length} thẻ</span>
        ${fresh ? `<span class="dot"></span><span>${fresh} mới</span>` : ''}
      </div>
    </a>`;
}
