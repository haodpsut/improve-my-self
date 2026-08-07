import { loadDeck, loadQuestions } from '../data.js';
import { dueCount, newCount, quizStat, sessionSize } from '../store.js';
import { esc, crumb } from '../ui.js';

const sizeLabel = (n, total) => (n === 0 ? `cả ${total}` : `${n}`);

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

    <div class="note-box" style="margin-bottom:16px">
      Mỗi lượt học chỉ lấy ra một phần của bộ, không phải cả bộ. Hiện đang đặt
      <strong>${sizeLabel(sessionSize('learn'), cards.length)} thẻ</strong> mỗi lượt học khái niệm và
      <strong>${sizeLabel(sessionSize('quiz'), authored.length + cards.length)} câu</strong> mỗi bài trắc nghiệm.
      Lượt sau sẽ ra thẻ khác, và bạn đổi được cỡ lượt ngay trên thanh phía trên khi đang học.
    </div>

    <div class="grid grid-modes">
      <a class="card mode-card" href="#/learn/${esc(deckId)}">
        <div class="mode-icon">🗂️</div>
        <div>
          <div class="mode-name">Học khái niệm</div>
          <div class="mode-desc">Thẻ lật hai mặt, tự chấm rồi lên lịch ôn lại theo hộp Leitner. Bộ có ${cards.length} thẻ.</div>
        </div>
      </a>
      <a class="card mode-card" href="#/quiz/${esc(deckId)}">
        <div class="mode-icon">✅</div>
        <div>
          <div class="mode-name">Trắc nghiệm</div>
          <div class="mode-desc">${authored.length} câu hiểu bản chất viết tay, trộn với câu sinh tự động từ ${cards.length} thẻ, câu nào cũng có giải thích.</div>
        </div>
      </a>
      <a class="card mode-card" href="#/say/${esc(deckId)}">
        <div class="mode-icon">🗣️</div>
        <div>
          <div class="mode-name">Đọc thành tiếng</div>
          <div class="mode-desc">${deck.lang === 'ru-vi'
            ? `Đọc to định nghĩa tiếng Nga, máy nghe bằng giọng Nga rồi chấm bằng thuật toán. Có ${cards.filter((c) => c.defA).length} thẻ đọc được.`
            : `Đọc câu ví dụ chứa thuật ngữ, máy nghe rồi chấm bằng thuật toán. Có ${cards.filter((c) => c.say).length} thẻ kèm câu ví dụ.`}</div>
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
