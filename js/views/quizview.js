import { loadDeck, loadQuestions } from '../data.js';
import { buildQuizSet } from '../quiz.js';
import { recordQuiz, gradeCard, sessionSize, setSessionSize, SIZE_CHOICES } from '../store.js';
import { esc, crumb, progressBar, scoreRing, sizePicker } from '../ui.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export async function renderQuiz(app, deckId) {
  const { deck, cards } = await loadDeck(deckId);
  const authored = await loadQuestions(deckId);
  // Kho cau hoi that = cau viet tay cong cau sinh duoc tu tung the.
  const pool = authored.length + cards.length;
  const size = sessionSize('quiz');
  const set = buildQuizSet({ cards, authored, size: size === 0 ? pool : size });

  if (!set.length) {
    app.innerHTML = `<div class="empty">Bộ này chưa đủ dữ liệu để sinh câu hỏi.</div>`;
    return;
  }

  let index = 0;
  let right = 0;
  let answered = false;
  const wrongOnes = [];

  function finish() {
    const pct = Math.round((right / set.length) * 100);
    app.innerHTML = `
      ${crumb([{ label: 'Trang chính', href: '#/' }, { label: deck.title, href: `#/deck/${deckId}` }, { label: 'Trắc nghiệm' }])}
      <div class="done-hero">
        <div class="big">${pct >= 80 ? '🏅' : pct >= 50 ? '📈' : '🧗'}</div>
        <h2>Đúng ${right} trên ${set.length}</h2>
        <p>${pct >= 80 ? 'Bộ này bạn nắm chắc rồi. Thử bộ khác hoặc chuyển sang luyện nói.' : 'Những câu sai đã được đánh dấu để quay lại sớm trong phần học khái niệm.'}</p>
        <div style="display:flex;justify-content:center;margin-bottom:18px">${scoreRing(pct)}</div>
        ${wrongOnes.length ? `
          <div class="note-box" style="text-align:left;max-width:640px;margin:0 auto 20px">
            <strong>Cần xem lại:</strong>
            <ul style="margin:8px 0 0;padding-left:20px">
              ${wrongOnes.map((w) => `<li>${esc(w)}</li>`).join('')}
            </ul>
          </div>` : ''}
        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-primary" id="btn-retry">Làm bộ câu khác</button>
          <a class="btn" href="#/learn/${esc(deckId)}">Ôn lại thẻ</a>
          <a class="btn btn-ghost" href="#/deck/${esc(deckId)}">Về bộ thẻ</a>
        </div>
      </div>`;
    app.querySelector('#btn-retry')?.addEventListener('click', () => renderQuiz(app, deckId));
  }

  function draw() {
    if (index >= set.length) return finish();
    const q = set[index];
    answered = false;

    app.innerHTML = `
      ${crumb([{ label: 'Trang chính', href: '#/' }, { label: deck.title, href: `#/deck/${deckId}` }, { label: 'Trắc nghiệm' }])}
      <div class="session-bar">
        <span>Câu ${index + 1} / ${set.length}</span>
        <span class="dot"></span>
        <span>đúng ${right}</span>
        ${q.generated ? '<span class="dot"></span><span>sinh từ thẻ</span>' : '<span class="dot"></span><span>câu hiểu bản chất</span>'}
        <span class="dot"></span>
        ${sizePicker(size, SIZE_CHOICES, pool, `câu có thể ra, gồm ${authored.length} câu viết tay`)}
        <span class="spacer"></span>
        <a class="btn btn-sm btn-ghost" href="#/deck/${esc(deckId)}">Dừng</a>
      </div>
      ${progressBar(index, set.length)}

      <div class="qbox">
        <div class="qtext">${esc(q.q)}</div>
        ${q.q_vi ? `<div class="qtext-vi">${esc(q.q_vi)}</div>` : ''}
        <div class="choices" id="choices">
          ${q.choices.map((c, i) => `
            <button class="choice" data-i="${i}">
              <span class="choice-key">${LETTERS[i]}</span>
              <span>${esc(c)}</span>
            </button>`).join('')}
        </div>
        <div id="why-slot"></div>
      </div>

      <div class="btn-row" style="margin-top:18px">
        <button class="btn btn-primary" id="btn-next" disabled>Câu tiếp theo</button>
      </div>
      <p class="flash-hint" style="margin-top:10px">Phím tắt: <code>1</code>–<code>4</code> chọn đáp án · <code>enter</code> sang câu kế.</p>
    `;

    const choose = (i) => {
      if (answered) return;
      answered = true;
      const buttons = [...app.querySelectorAll('.choice')];
      buttons.forEach((b) => { b.disabled = true; });
      buttons[q.answer]?.classList.add('correct');
      const ok = i === q.answer;
      if (!ok) {
        buttons[i]?.classList.add('wrong');
        wrongOnes.push(q.term ? `${q.term} — ${q.gloss || ''}` : q.q.slice(0, 90));
        if (q.cardId) gradeCard(q.cardId, 'again');
      } else {
        right += 1;
        if (q.cardId) gradeCard(q.cardId, 'good');
      }
      recordQuiz(deckId, ok);

      const why = app.querySelector('#why-slot');
      if (q.why || q.why_vi) {
        why.innerHTML = `
          <div class="why">
            <div class="why-head">${ok ? 'Vì sao đúng' : 'Vì sao đáp án kia mới đúng'}</div>
            ${q.why ? `<p>${esc(q.why)}</p>` : ''}
            ${q.why_vi ? `<p class="vi">${esc(q.why_vi)}</p>` : ''}
          </div>`;
      }
      const next = app.querySelector('#btn-next');
      next.disabled = false;
      next.focus();
    };

    app.querySelector('#size-sel')?.addEventListener('change', (e) => {
      setSessionSize('quiz', Number(e.target.value));
      document.removeEventListener('keydown', onKey);
      renderQuiz(app, deckId);
    });

    app.querySelectorAll('.choice').forEach((b) => {
      b.addEventListener('click', () => choose(Number(b.dataset.i)));
    });
    app.querySelector('#btn-next')?.addEventListener('click', () => { index += 1; draw(); });

    keyHandler = (ev) => {
      if (ev.target.matches('input, textarea')) return;
      const n = Number(ev.key);
      if (n >= 1 && n <= q.choices.length) choose(n - 1);
      else if (ev.key === 'Enter' && answered) { index += 1; draw(); }
    };
  }

  let keyHandler = null;
  const onKey = (ev) => keyHandler?.(ev);
  document.addEventListener('keydown', onKey);
  app._cleanup = () => document.removeEventListener('keydown', onKey);

  draw();
}
