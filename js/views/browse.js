import { getManifest, loadAllDecks, loadDeck } from '../data.js';
import { cardState } from '../store.js';
import { esc, crumb, emptyState } from '../ui.js';
import { speak, canSpeak } from '../speech.js';

export async function renderBrowse(app, deckId) {
  const manifest = await getManifest();
  const bundles = deckId ? [await loadDeck(deckId)] : await loadAllDecks();
  const cards = bundles.flatMap((b) => b.cards);

  const tagCounts = new Map();
  cards.forEach((c) => c.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1)));
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);

  let query = '';
  let activeTag = '';
  let activeDeck = deckId || '';

  const head = deckId
    ? crumb([{ label: 'Trang chính', href: '#/' }, { label: bundles[0].deck.title, href: `#/deck/${deckId}` }, { label: 'Tra cứu' }])
    : crumb([{ label: 'Trang chính', href: '#/' }, { label: 'Tra cứu' }]);

  app.innerHTML = `
    ${head}
    <div class="page-head">
      <h1>Tra cứu ${deckId ? esc(bundles[0].deck.title) : 'toàn bộ thuật ngữ'}</h1>
      <p>${cards.length} thẻ. Gõ tiếng Anh, tiếng Nga hay tiếng Việt đều tìm được, kể cả trong phần định nghĩa.</p>
    </div>

    <div class="search-bar">
      <input class="input" id="q" type="search" placeholder="Tìm thuật ngữ, nghĩa, hoặc định nghĩa…" autocomplete="off">
    </div>

    ${deckId ? '' : `
      <div class="filter-row" id="deck-filters">
        <button class="chip on" data-deck="">Tất cả bộ</button>
        ${manifest.decks.map((d) => `<button class="chip" data-deck="${esc(d.id)}">${esc(d.icon || '')} ${esc(d.title)}</button>`).join('')}
      </div>`}

    ${topTags.length ? `
      <div class="filter-row" id="tag-filters">
        <button class="chip on" data-tag="">Mọi nhãn</button>
        ${topTags.map(([t, n]) => `<button class="chip" data-tag="${esc(t)}">${esc(t)} <span style="opacity:.55">${n}</span></button>`).join('')}
      </div>` : ''}

    <div id="results"></div>
  `;

  const results = app.querySelector('#results');

  function match(c) {
    if (activeDeck && c.deckId !== activeDeck) return false;
    if (activeTag && !c.tags.includes(activeTag)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return [c.head, c.gloss, c.translit, c.altEn, c.defA, c.defB, c.say, c.tags.join(' ')]
      .filter(Boolean)
      .some((f) => String(f).toLowerCase().includes(q));
  }

  function draw() {
    const list = cards.filter(match);
    if (!list.length) {
      results.innerHTML = emptyState('Không có thẻ nào khớp. Thử từ khoá ngắn hơn.');
      return;
    }
    results.innerHTML = `
      <div class="flash-hint" style="margin-bottom:10px">${list.length} kết quả</div>
      ${list.slice(0, 400).map(entry).join('')}
      ${list.length > 400 ? `<div class="flash-hint" style="margin-top:10px">Còn ${list.length - 400} thẻ nữa, hãy lọc hẹp lại.</div>` : ''}`;

    if (canSpeak()) {
      results.querySelectorAll('[data-say]').forEach((b) => {
        b.addEventListener('click', () => speak(b.dataset.say, { lang: b.dataset.lang || 'en-US' }));
      });
    }
  }

  function entry(c) {
    const st = cardState(c.id);
    const badge = st.seen ? `hộp ${st.box}` : 'chưa gặp';
    return `
      <div class="entry" style="border-left:3px solid ${esc(c.deckColor || 'var(--accent)')}">
        <div class="entry-head">
          <span class="entry-term">${esc(c.head)}</span>
          ${c.translit ? `<span class="translit">[${esc(c.translit)}]</span>` : ''}
          ${c.ipa ? `<span class="translit">${esc(c.ipa)}</span>` : ''}
          ${c.gloss ? `<span class="entry-vi">${esc(c.gloss)}</span>` : ''}
          ${canSpeak() ? `<button class="btn btn-sm btn-ghost" data-say="${esc(c.say || c.head)}" data-lang="${esc(c.headLang)}">🔊</button>` : ''}
        </div>
        ${c.altEn ? `<div class="entry-def-vi">${esc(c.altEn)}</div>` : ''}
        ${c.defA ? `<div class="entry-def">${esc(c.defA)}</div>` : ''}
        ${c.defB ? `<div class="entry-def-vi">${esc(c.defB)}</div>` : ''}
        ${c.say ? `<div class="entry-def-vi" style="font-style:italic">“${esc(c.say)}”</div>` : ''}
        <div class="entry-meta">
          <span>${esc(c.deckIcon || '')} ${esc(c.deckTitle)}</span>
          <span>·</span>
          <span>${esc(badge)}</span>
          ${c.tags.length ? `<span>·</span><span>${c.tags.map(esc).join(', ')}</span>` : ''}
        </div>
      </div>`;
  }

  app.querySelector('#q').addEventListener('input', (e) => { query = e.target.value.trim(); draw(); });
  app.querySelectorAll('#deck-filters .chip').forEach((b) => {
    b.addEventListener('click', () => {
      activeDeck = b.dataset.deck;
      app.querySelectorAll('#deck-filters .chip').forEach((x) => x.classList.toggle('on', x === b));
      draw();
    });
  });
  app.querySelectorAll('#tag-filters .chip').forEach((b) => {
    b.addEventListener('click', () => {
      activeTag = b.dataset.tag;
      app.querySelectorAll('#tag-filters .chip').forEach((x) => x.classList.toggle('on', x === b));
      draw();
    });
  });

  draw();
}
