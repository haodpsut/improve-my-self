import { loadSpeakingSet, loadDeck } from '../data.js';
import { recordSpeak, sessionSize, setSessionSize, SIZE_CHOICES } from '../store.js';
import { esc, crumb, progressBar, scoreRing, sizePicker } from '../ui.js';
import { speak, canSpeak, canListen, listenOnce, scoreSpoken, stopSpeaking } from '../speech.js';

/* ---------- Tinh huong hoi thoai ---------- */

export async function renderSpeak(app, setId) {
  const { meta, drills } = await loadSpeakingSet(setId);
  if (!drills.length) {
    app.innerHTML = `<div class="empty">Bộ này chưa có tình huống nào.</div>`;
    return;
  }
  const size = sessionSize('speak');
  runDrills(app, {
    id: setId,
    title: meta.title,
    icon: meta.icon || '🎤',
    blurb: meta.blurb || '',
    backHref: '#/',
    backLabel: 'Trang chính',
    items: shuffleSlice(drills, size === 0 ? drills.length : size),
    size,
    total: drills.length,
    unit: 'tình huống của bộ',
    rerun: () => renderSpeak(app, setId)
  });
}

/* ---------- Doc to cau vi du cua bo the ---------- */

export async function renderSay(app, deckId) {
  const { deck, cards } = await loadDeck(deckId);
  const items = cards
    .filter((c) => c.say)
    .map((c) => ({
      id: `say-${c.id}`,
      situation: `${c.head}${c.gloss ? ` · ${c.gloss}` : ''}`,
      target: c.say,
      target_vi: c.defB || '',
      keys: [],
      tip: c.defA || ''
    }));

  if (!items.length) {
    app.innerHTML = `
      ${crumb([{ label: 'Trang chính', href: '#/' }, { label: deck.title, href: `#/deck/${deckId}` }, { label: 'Đọc thành tiếng' }])}
      <div class="empty">Bộ thẻ này chưa có thẻ nào kèm câu ví dụ. Thêm trường <code>say</code> vào thẻ trong JSON là phần này có bài ngay.</div>`;
    return;
  }

  const size = sessionSize('speak');
  runDrills(app, {
    id: `say-${deckId}`,
    title: `Đọc thành tiếng · ${deck.title}`,
    icon: '🗣️',
    blurb: 'Đọc to câu ví dụ. Máy nghe rồi so từng từ với câu gốc, không nhờ mô hình nào chấm.',
    backHref: `#/deck/${deckId}`,
    backLabel: deck.title,
    items: shuffleSlice(items, size === 0 ? items.length : size),
    size,
    total: items.length,
    unit: 'thẻ có câu ví dụ',
    rerun: () => renderSay(app, deckId)
  });
}

function shuffleSlice(list, n) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/* ---------- Vong chay chung ---------- */

function runDrills(app, cfg) {
  let index = 0;
  let stopListening = null;
  let listening = false;
  let said = '';
  let result = null;
  const scores = [];

  function cleanup() {
    stopListening?.();
    stopListening = null;
    listening = false;
    stopSpeaking();
  }
  app._cleanup = cleanup;

  function finish() {
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    app.innerHTML = `
      ${crumb([{ label: cfg.backLabel, href: cfg.backHref }, { label: cfg.title }])}
      <div class="done-hero">
        <div class="big">${avg >= 75 ? '🎉' : avg >= 45 ? '👍' : '🔁'}</div>
        <h2>Điểm trung bình ${avg}</h2>
        <p>${avg >= 75
          ? 'Bạn bật ra được câu, không phải dịch trong đầu nữa. Nâng độ khó bằng cách trả lời trước khi đọc câu mẫu.'
          : 'Điểm chỉ đo mức trùng với câu mẫu. Nói đúng ý bằng từ khác vẫn tốt, nhưng các cụm khoá thì nên bật ra được.'}</p>
        <div style="display:flex;justify-content:center;margin-bottom:18px">${scoreRing(avg)}</div>
        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-primary" id="btn-again">Chạy lại bộ này</button>
          <a class="btn btn-ghost" href="${cfg.backHref}">Quay lại</a>
        </div>
      </div>`;
    app.querySelector('#btn-again')?.addEventListener('click', () => cfg.rerun());
  }

  function draw() {
    if (index >= cfg.items.length) return finish();
    const d = cfg.items[index];
    const hasPrompt = Boolean(d.prompt);
    const showAnswer = Boolean(result);

    app.innerHTML = `
      ${crumb([{ label: cfg.backLabel, href: cfg.backHref }, { label: cfg.title }])}
      <div class="session-bar">
        <span>${index + 1} / ${cfg.items.length}</span>
        <span class="dot"></span>
        <span>${esc(cfg.icon)} ${esc(cfg.title)}</span>
        <span class="dot"></span>
        ${sizePicker(cfg.size, SIZE_CHOICES, cfg.total, cfg.unit)}
        <span class="spacer"></span>
        <a class="btn btn-sm btn-ghost" href="${cfg.backHref}">Dừng</a>
      </div>
      ${progressBar(index, cfg.items.length)}

      <div class="speak-prompt">
        ${d.situation ? `<div class="speak-sit">${esc(d.situation)}</div>` : ''}
        ${hasPrompt
          ? `<div class="speak-line">${esc(d.prompt)}</div>
             ${d.prompt_vi ? `<div class="speak-line-vi">${esc(d.prompt_vi)}</div>` : ''}`
          : `<div class="speak-line">${esc(d.target)}</div>
             ${d.target_vi ? `<div class="speak-line-vi">${esc(d.target_vi)}</div>` : ''}`}
        <div class="btn-row" style="margin-top:14px">
          ${canSpeak() ? `<button class="btn btn-sm" id="btn-hear">🔊 Nghe câu này</button>` : ''}
          ${hasPrompt && d.seconds ? `<span class="mic-hint">Mục tiêu: bật ra câu trong ${d.seconds} giây.</span>` : ''}
        </div>
      </div>

      <div class="mic-row">
        <button class="mic-btn ${listening ? 'recording' : ''}" id="btn-mic" title="Bấm để nói">
          ${listening ? '⏹' : '🎙'}
        </button>
        <div>
          <div class="mic-hint" id="mic-state">
            ${canListen()
              ? (listening ? 'Đang nghe, nói xong bấm lại để dừng.' : 'Bấm micro rồi nói câu trả lời của bạn.')
              : 'Trình duyệt này chưa hỗ trợ nhận dạng giọng nói. Hãy gõ câu bạn định nói vào ô dưới, phần chấm vẫn chạy đủ.'}
          </div>
        </div>
      </div>

      ${canListen()
        ? `<div class="transcript" id="transcript">${said ? `<strong>${esc(said)}</strong>` : 'Bản ghi lời bạn nói sẽ hiện ở đây.'}</div>`
        : `<input class="input" id="typed" placeholder="Gõ câu bạn định nói…" value="${esc(said)}" style="width:100%">`}

      <div class="btn-row" style="margin-top:14px">
        <button class="btn" id="btn-check" ${showAnswer ? 'disabled' : ''}>Chấm điểm</button>
        <button class="btn btn-ghost" id="btn-skip">Bỏ qua</button>
        <span style="flex:1"></span>
        <button class="btn btn-primary" id="btn-next" ${showAnswer ? '' : 'disabled'}>Tiếp theo</button>
      </div>

      <div id="result-slot">${showAnswer ? resultBlock(d, result) : ''}</div>
    `;

    app.querySelector('#size-sel')?.addEventListener('change', (e) => {
      setSessionSize('speak', Number(e.target.value));
      cleanup();
      cfg.rerun();
    });

    app.querySelector('#btn-hear')?.addEventListener('click', () => {
      speak(hasPrompt ? d.prompt : d.target, { lang: 'en-US', rate: 0.92 });
    });

    app.querySelector('#btn-mic')?.addEventListener('click', () => {
      if (!canListen()) {
        app.querySelector('#typed')?.focus();
        return;
      }
      if (listening) {
        stopListening?.();
        return;
      }
      said = '';
      listening = true;
      draw();
      stopListening = listenOnce({
        lang: 'en-US',
        onResult: (text) => {
          said = text;
          const t = app.querySelector('#transcript');
          if (t) t.innerHTML = `<strong>${esc(text)}</strong>`;
        },
        onEnd: (text) => {
          said = text || said;
          listening = false;
          stopListening = null;
          if (said) check();
          else draw();
        },
        onError: (err) => {
          listening = false;
          stopListening = null;
          const s = app.querySelector('#mic-state');
          if (s) s.textContent = `Không nghe được: ${err.message}. Bạn có thể bấm lại hoặc gõ tay.`;
        }
      });
    });

    function check() {
      const typed = app.querySelector('#typed');
      if (typed) said = typed.value;
      if (!said.trim()) {
        const s = app.querySelector('#mic-state');
        if (s) s.textContent = 'Chưa có gì để chấm. Hãy nói hoặc gõ câu của bạn trước.';
        return;
      }
      result = scoreSpoken(said, d.target, d.keys || []);
      scores.push(result.score);
      recordSpeak(cfg.id, result.score);
      draw();
    }

    app.querySelector('#btn-check')?.addEventListener('click', check);
    app.querySelector('#btn-skip')?.addEventListener('click', () => {
      cleanup();
      index += 1; said = ''; result = null; draw();
    });
    app.querySelector('#btn-next')?.addEventListener('click', () => {
      cleanup();
      index += 1; said = ''; result = null; draw();
    });
  }

  draw();
}

function resultBlock(d, r) {
  const keys = (d.keys || []).map((k) => {
    const hit = r.keyHits.find((h) => h.key === k)?.hit;
    return `<span class="key ${hit ? 'hit' : 'miss'}">${hit ? '✓' : '✗'} ${esc(k)}</span>`;
  }).join('');

  return `
    <div class="score-row">
      ${scoreRing(r.score)}
      <div class="score-note">
        Trùng ${r.coverage}% số từ nội dung của câu mẫu, bạn nói ${r.words} từ.
        ${r.missing.length ? `<br><span style="color:var(--ink-3)">Từ chưa nói tới: ${esc(r.missing.join(', '))}</span>` : ''}
      </div>
    </div>
    ${keys ? `<div class="key-list">${keys}</div>` : ''}
    <div class="model-answer">
      <div class="lbl">Câu mẫu</div>
      <div class="en">${esc(d.target)}</div>
      ${d.target_vi ? `<div class="vi">${esc(d.target_vi)}</div>` : ''}
    </div>
    ${d.tip ? `<div class="tip">${esc(d.tip)}</div>` : ''}
  `;
}
