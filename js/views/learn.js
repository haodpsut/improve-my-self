import { loadDeck, loadEverything } from '../data.js';
import { buildQueue, gradeCard, cardState, sessionSize, setSessionSize, SIZE_CHOICES } from '../store.js';
import { esc, crumb, chainBar, progressBar, sizePicker } from '../ui.js';
import { speak, canSpeak } from '../speech.js';

/**
 * chain khong rong nghia la man nay dang la mot chang cua chuoi hoc hang ngay.
 * Khi do du lieu da duoc nap san, co luot do ke hoach quyet dinh, va khi hoc xong
 * thi khong hien man ket thuc rieng ma tra quyen dieu khien lai cho chuoi.
 */
export async function renderLearn(app, deckId, chain = null) {
  const isAll = deckId === 'all';
  const { deck, cards } = chain?.bundle || (isAll ? await loadEverything() : await loadDeck(deckId));
  const backHref = chain ? '#/plan' : isAll ? '#/' : `#/deck/${deckId}`;
  if (!cards.length) {
    app.innerHTML = `<div class="empty">Bộ thẻ này chưa có thẻ nào.</div>`;
    return;
  }

  const size = chain ? chain.size : sessionSize('learn');
  const queue = buildQueue(cards, size === 0 ? cards.length : size);
  let index = 0;
  let flipped = false;
  const graded = { good: 0, hard: 0, again: 0 };
  // The da thuc su cham diem trong luot nay. Chang trac nghiem ke tiep se ra de
  // tu dung nhung the vua hoc, chu khong boc ngau nhien tu toan kho.
  const touched = [];

  function done() {
    keyHandler = null; // man hinh ket thuc khong nhan phim tat cua phien hoc
    if (chain) {
      chain.onDone({ total: queue.length, ...graded, cards: touched });
      return;
    }
    app.innerHTML = `
      ${crumb([{ label: 'Trang chính', href: '#/' }, { label: deck.title, href: backHref }, { label: 'Học khái niệm' }])}
      <div class="done-hero">
        <div class="big">🎯</div>
        <h2>Xong ${queue.length} thẻ</h2>
        <p>Thuộc ${graded.good}, còn ngập ngừng ${graded.hard}, phải học lại ${graded.again}. Những thẻ bạn bấm học lại sẽ quay lại ngay hôm nay.</p>
        <p style="font-size:14px">${isAll
          ? `Toàn kho có ${cards.length} thẻ trải trên mọi bộ.`
          : `Bộ này có tất cả ${cards.length} thẻ.`} Bấm học tiếp để sang lượt kế, hoặc đổi cỡ lượt ở thanh trên khi đang học.</p>
        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-primary" id="btn-again-round">Học tiếp lượt nữa</button>
          <a class="btn" href="#/quiz/${esc(deckId)}">Sang trắc nghiệm</a>
          <a class="btn btn-ghost" href="${backHref}">${isAll ? "Về trang chính" : "Về bộ thẻ"}</a>
        </div>
      </div>`;
    app.querySelector('#btn-again-round')?.addEventListener('click', () => {
      document.removeEventListener('keydown', onKey);
      renderLearn(app, deckId, chain);
    });
  }

  function draw() {
    if (index >= queue.length) return done();
    const c = queue[index];
    const st = cardState(c.id);
    const boxLabel = st.seen ? `hộp ${st.box}` : 'thẻ mới';

    app.innerHTML = `
      ${chain
        ? chainBar(chain)
        : crumb([{ label: 'Trang chính', href: '#/' }, { label: deck.title, href: backHref }, { label: 'Học khái niệm' }])}
      <div class="session-bar">
        <span>${index + 1} / ${queue.length}</span>
        <span class="dot"></span>
        <span>${esc(boxLabel)}</span>
        ${chain ? '' : `
        <span class="dot"></span>
        ${sizePicker(size, SIZE_CHOICES, cards.length, isAll ? 'thẻ trên toàn kho' : 'thẻ của bộ')}
        <span class="spacer"></span>
        <a class="btn btn-sm btn-ghost" href="${backHref}">Dừng</a>`}
      </div>
      ${progressBar(index, queue.length)}

      <div class="flash ${flipped ? 'is-flipped' : ''}" id="flash">
        <div class="flash-inner" id="flash-inner">
          <div class="flash-face">
            <div class="flash-hint">${esc(c.deckIcon || deck.icon || '')} ${esc(c.deckTitle || deck.title)}</div>
            <div class="flash-term ${c.lang === 'ru-vi' ? 'term-ru' : ''}">${esc(c.head)}</div>
            ${c.translit ? `<div class="translit">[${esc(c.translit)}]</div>` : ''}
            ${c.ipa ? `<div class="translit">${esc(c.ipa)}</div>` : ''}
            <div class="flash-hint">Bấm vào thẻ để lật, hoặc nhấn phím cách.</div>
          </div>
          <div class="flash-face flash-back">
            <div class="flash-hint">${esc(c.deckIcon || deck.icon || '')} ${esc(c.deckTitle || deck.title)}</div>
            <div>
              <div class="flash-term" style="font-size:clamp(20px,3.6vw,28px)">${esc(c.gloss || c.head)}</div>
              ${c.altEn ? `<div class="flash-sub">${esc(c.altEn)}</div>` : ''}
            </div>
            ${c.defA ? `<div class="flash-def">${esc(c.defA)}</div>` : ''}
            ${c.defB ? `<div class="flash-def" style="color:var(--ink-3)">${esc(c.defB)}</div>` : ''}
            ${c.say ? `<div class="flash-say">“${esc(c.say)}”</div>` : ''}
            ${c.src.length ? `<div class="flash-src">Nguồn: ${c.src.map((s) => `<a href="https://arxiv.org/abs/${esc(s)}" target="_blank" rel="noopener">arXiv:${esc(s)}</a>`).join(' · ')}</div>` : ''}
            ${c.tags.length ? `<div class="flash-tags">${c.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
      </div>

      <!-- Hai hang rieng, khong phai mot hang tu xuong dong. Tren dien thoai, mot
           hang duy nhat se de nut "Học lại" ket lai o cuoi hang dieu huong va bi
           bop thanh hai dong chu, con hai nut cham con lai roi xuong hang duoi. -->
      <div class="btn-row nav-row">
        <button class="btn btn-nav" id="btn-prev" ${index === 0 ? 'disabled' : ''} title="Thẻ trước, không chấm">←</button>
        <button class="btn btn-nav" id="btn-next" title="Thẻ sau, không chấm">→</button>
        ${canSpeak() ? `<button class="btn" id="btn-say">🔊 Nghe</button>` : ''}
        <button class="btn" id="btn-flip">${flipped ? 'Lật lại' : 'Lật thẻ'}</button>
      </div>
      <div class="btn-row grade-row">
        <button class="btn btn-again" id="g-again" ${flipped ? '' : 'disabled'}>Học lại</button>
        <button class="btn btn-hard" id="g-hard" ${flipped ? '' : 'disabled'}>Còn ngập ngừng</button>
        <button class="btn btn-good" id="g-good" ${flipped ? '' : 'disabled'}>Thuộc</button>
      </div>
      <p class="flash-hint" style="margin-top:12px">
        Phím tắt: <code>←</code> <code>→</code> lùi và tiến mà không chấm ·
        <code>space</code> lật · <code>1</code> học lại · <code>2</code> ngập ngừng · <code>3</code> thuộc
      </p>
    `;

    app.querySelector('#size-sel')?.addEventListener('change', (e) => {
      setSessionSize('learn', Number(e.target.value));
      document.removeEventListener('keydown', onKey);
      renderLearn(app, deckId, chain);
    });

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
      if (!touched.some((t) => t.id === c.id)) touched.push(c);
      if (g === 'again') queue.push(c);
      index += 1;
      flipped = false;
      draw();
    };
    app.querySelector('#g-again')?.addEventListener('click', () => grade('again'));
    app.querySelector('#g-hard')?.addEventListener('click', () => grade('hard'));
    app.querySelector('#g-good')?.addEventListener('click', () => grade('good'));

    // Di chuyen qua lai ma KHONG cham diem, de xem lai the vua roi hoac bo qua
    // the chua muon danh gia. Lich on chi doi khi nguoi hoc bam mot nut cham.
    const go = (delta) => {
      const next = index + delta;
      if (next < 0 || next > queue.length) return;
      index = next;
      flipped = false;
      draw();
    };
    app.querySelector('#btn-prev')?.addEventListener('click', () => go(-1));
    app.querySelector('#btn-next')?.addEventListener('click', () => go(1));

    keyHandler = (ev) => {
      // ev.target co the la document, va document khong co ham matches,
      // goi thang se nem loi va nuot luon moi phim tat.
      if (typeof ev.target?.matches === 'function' && ev.target.matches('input, textarea, select')) return;
      if (ev.code === 'Space') { ev.preventDefault(); flip(); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(-1); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); go(1); }
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
