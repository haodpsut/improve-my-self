import { loadDeck, loadQuestions } from '../data.js';
import { dueCount, newCount, quizStat } from '../store.js';
import { esc, crumb } from '../ui.js';

export async function renderDeck(app, deckId) {
  const { deck, cards, updated } = await loadDeck(deckId);
  const authored = await loadQuestions(deckId);
  const ids = cards.map((c) => c.id);
  const due = dueCount(ids);
  const fresh = newCount(ids);
  const qs = quizStat(deckId);

  app.innerHTML = `
    ${crumb([{ label: 'Trang chính', href: '#/' }, { label: deck.title }])}
    <div class="page-head">
      <div class="eyebrow">${esc(deck.icon || '')} ${esc(deck.title_en || '')} · cập nhật ${esc(updated)}</div>
      <h1>${esc(deck.title)}</h1>
      <p>${esc(deck.blurb || '')}</p>
    </div>

    <div class="grid grid-stats" style="margin-bottom:22px">
      <div class="stat"><div class="stat-value">${cards.length}</div><div class="stat-label">thẻ trong bộ</div></div>
      <div class="stat"><div class="stat-value">${due}</div><div class="stat-label">đến hạn ôn</div></div>
      <div class="stat"><div class="stat-value">${fresh}</div><div class="stat-label">chưa gặp lần nào</div></div>
      <div class="stat"><div class="stat-value">${qs.asked ? Math.round((qs.right / qs.asked) * 100) : 0}%</div><div class="stat-label">đúng khi trắc nghiệm</div></div>
    </div>

    <div class="grid grid-modes">
      <a class="card mode-card" href="#/learn/${esc(deckId)}">
        <div class="mode-icon">🗂️</div>
        <div>
          <div class="mode-name">Học khái niệm</div>
          <div class="mode-desc">Thẻ lật hai mặt, tự chấm rồi lên lịch ôn lại theo hộp Leitner.</div>
        </div>
      </a>
      <a class="card mode-card" href="#/quiz/${esc(deckId)}">
        <div class="mode-icon">✅</div>
        <div>
          <div class="mode-name">Trắc nghiệm</div>
          <div class="mode-desc">${authored.length ? `${authored.length} câu hiểu bản chất` : 'Câu sinh từ thẻ'}, trộn với câu sinh tự động, câu nào cũng có giải thích.</div>
        </div>
      </a>
      <a class="card mode-card" href="#/say/${esc(deckId)}">
        <div class="mode-icon">🗣️</div>
        <div>
          <div class="mode-name">Đọc thành tiếng</div>
          <div class="mode-desc">Đọc câu ví dụ chứa thuật ngữ, máy nghe rồi chấm bằng thuật toán.</div>
        </div>
      </a>
      <a class="card mode-card" href="#/browse/${esc(deckId)}">
        <div class="mode-icon">🔍</div>
        <div>
          <div class="mode-name">Tra cứu cả bộ</div>
          <div class="mode-desc">Xem toàn bộ thẻ, lọc theo nhãn, tìm nhanh bằng tiếng Anh hoặc tiếng Việt.</div>
        </div>
      </a>
    </div>
  `;
}
