import { loadDeck } from '../data.js';
import { buildQueue, gradeCard, cardState } from '../store.js';
import { esc, crumb, progressBar } from '../ui.js';
import { speak, canSpeak } from '../speech.js';

const SESSION = 20;

export async function renderLearn(app, deckId) {
  const { deck, cards } = await loadDeck(deckId);
  if (!cards.length) {
    app.innerHTML = `<div class="empty">Bộ thẻ này chưa có thẻ nào.</div>`;
    return;
  }

  const queue = buildQueue(cards, SESSION);
  let index = 0;
  let flipped = false;
  const graded = { good: 0, hard: 0, again: 0 };

  function done() {
    app.innerHTML = `
      ${crumb([{ label: 'Trang chính', href: '#/' }, { label: deck.title, href: `#/deck/${deckId}` }, { label: 'Học khái niệm' }])}
      <div class="done-hero">
        <div class="big">🎯</div>
        <h2>Xong ${queue.length} thẻ</h2>
        <p>Thuộc ${graded.good}, còn ngập ngừng ${graded.hard}, phải học lại ${graded.again}. Những thẻ bạn bấm học lại sẽ quay lại ngay hôm nay.</p>
        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-primary" id="btn-again-round">Học tiếp lượt nữa</button>
          <a class="btn" href="#/quiz/${esc(deckId)}">Sang trắc nghiệm</a>
          <a class="btn btn-ghost" href="#/deck/${esc(deckId)}">Về bộ thẻ</a>
        </div>
      </div>`;
    app.querySelector('#btn-again-round')?.addEventListener('click', () => {
      document.removeEventListener('keydown', onKey);
      renderLearn(app, deckId);
    });
  }

  function draw() {
    if (index >= queue.length) return done();
    const c = queue[index];
    const st = cardState(c.id);
    const boxLabel = st.seen ? `hộp ${st.box}` : 'thẻ mới';

    app.innerHTML = `
      ${crumb([{ label: 'Trang chính', href: '#/' }, { label: deck.title, href: `#/deck/${deckId}` }, { label: 'Học khái niệm' }])}
      <div class="session-bar">
        <span>${index + 1} / ${queue.length}</span>
        <span class="dot"></span>
        <span>${esc(boxLabel)}</span>
        <span class="spacer"></span>
        <a class="btn btn-sm btn-ghost" href="#/deck/${esc(deckId)}">Dừng</a>
      </div>
      ${progressBar(index, queue.length)}

      <div class="flash ${flipped ? 'is-flipped' : ''}" id="flash">
        <div class="flash-inner" id="flash-inner">
          <div class="flash-face">
            <div class="flash-hint">${esc(deck.icon || '')} ${esc(deck.title)}</div>
            <div class="flash-term ${c.lang === 'ru-vi' ? 'term-ru' : ''}">${esc(c.head)}</div>
            ${c.translit ? `<div class="translit">[${esc(c.translit)}]</div>` : ''}
            ${c.ipa ? `<div class="translit">${esc(c.ipa)}</div>` : ''}
            <div class="flash-hint">Bấm vào thẻ để lật, hoặc nhấn phím cách.</div>
          </div>
          <div class="flash-face flash-back">
            <div>
              <div class="flash-term" style="font-size:clamp(20px,3.6vw,28px)">${esc(c.gloss || c.head)}</div>
              ${c.altEn ? `<div class="flash-sub">${esc(c.altEn)}</div>` : ''}
            </div>
            ${c.defA ? `<div class="flash-def">${esc(c.defA)}</div>` : ''}
            ${c.defB ? `<div class="flash-def" style="color:var(--ink-3)">${esc(c.defB)}</div>` : ''}
            ${c.say ? `<div class="flash-say">“${esc(c.say)}”</div>` : ''}
            ${c.tags.length ? `<div class="flash-tags">${c.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="btn-row">
        ${canSpeak() ? `<button class="btn" id="btn-say">🔊 Nghe</button>` : ''}
        <button class="btn" id="btn-flip">${flipped ? 'Lật lại' : 'Lật thẻ'}</button>
        <span class="spacer" style="flex:1"></span>
        <button class="btn btn-again" id="g-again" ${flipped ? '' : 'disabled'}>Học lại</button>
        <button class="btn btn-hard" id="g-hard" ${flipped ? '' : 'disabled'}>Còn ngập ngừng</button>
        <button class="btn btn-good" id="g-good" ${flipped ? '' : 'disabled'}>Thuộc</button>
      </div>
      <p class="flash-hint" style="margin-top:12px">Phím tắt: <code>space</code> lật · <code>1</code> học lại · <code>2</code> ngập ngừng · <code>3</code> thuộc</p>
    `;

    const flip = () => { flipped = !flipped; draw(); };
    app.querySelector('#flash-inner')?.addEventListener('click', flip);
    app.querySelector('#btn-flip')?.addEventListener('click', flip);
    app.querySelector('#btn-say')?.addEventListener('click', (e) => {
      e.stopPropagation();
      speak(c.say || c.head, { lang: c.headLang });
    });

    const grade = (g) => {
      if (!flipped) return;
      gradeCard(c.id, g);
      graded[g] += 1;
      if (g === 'again') queue.push(c);
      index += 1;
      flipped = false;
      draw();
    };
    app.querySelector('#g-again')?.addEventListener('click', () => grade('again'));
    app.querySelector('#g-hard')?.addEventListener('click', () => grade('hard'));
    app.querySelector('#g-good')?.addEventListener('click', () => grade('good'));

    keyHandler = (ev) => {
      if (ev.target.matches('input, textarea')) return;
      if (ev.code === 'Space') { ev.preventDefault(); flip(); }
      else if (ev.key === '1') grade('again');
      else if (ev.key === '2') grade('hard');
      else if (ev.key === '3') grade('good');
    };
  }

  let keyHandler = null;
  const onKey = (ev) => keyHandler?.(ev);
  document.addEventListener('keydown', onKey);
  app.dataset.cleanup = 'learn';
  app._cleanup = () => document.removeEventListener('keydown', onKey);

  draw();
}
