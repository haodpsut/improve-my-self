import { getManifest, loadAllDecks } from '../data.js';
import { overview, streak, lastDays, dueCount, newCount, quizStat, speakStat, exportJSON, importJSON, reset } from '../store.js';
import { esc, crumb, fmtDate } from '../ui.js';

export async function renderStats(app) {
  const manifest = await getManifest();
  const bundles = await loadAllDecks();
  const ov = overview();
  const days = lastDays(14);
  const maxDay = Math.max(1, ...days.map((d) => d.total));
  const totalCards = bundles.reduce((n, b) => n + b.cards.length, 0);

  app.innerHTML = `
    ${crumb([{ label: 'Trang chính', href: '#/' }, { label: 'Tiến độ' }])}
    <div class="page-head">
      <h1>Tiến độ của bạn</h1>
      <p>Toàn bộ số liệu nằm trong trình duyệt của máy này, không gửi đi đâu cả. Đổi máy thì xuất ra JSON rồi nạp lại.</p>
    </div>

    <div class="grid grid-stats" style="margin-bottom:26px">
      <div class="stat"><div class="stat-value">${streak()}</div><div class="stat-label">ngày liên tiếp có học</div></div>
      <div class="stat"><div class="stat-value">${ov.touched}<span style="font-size:15px;color:var(--ink-3)">/${totalCards}</span></div><div class="stat-label">thẻ đã chạm tới</div></div>
      <div class="stat"><div class="stat-value">${ov.learned}</div><div class="stat-label">thẻ vào hộp 3 trở lên</div></div>
      <div class="stat"><div class="stat-value">${ov.quiz.asked ? Math.round((ov.quiz.right / ov.quiz.asked) * 100) : 0}%</div><div class="stat-label">đúng trên ${ov.quiz.asked} câu</div></div>
      <div class="stat"><div class="stat-value">${ov.speak.tries ? Math.round(ov.speak.total / ov.speak.tries) : 0}</div><div class="stat-label">điểm nói trung bình</div></div>
    </div>

    <div class="section-title">Hoạt động 14 ngày gần nhất</div>
    <div class="bars">
      ${days.map((d) => `
        <div class="bar-row">
          <span style="color:var(--ink-3)">${fmtDate(d.date)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${Math.round((d.total / maxDay) * 100)}%"></span></span>
          <span class="bar-num">${d.total ? `${d.total} lượt` : '—'}</span>
        </div>`).join('')}
    </div>

    <div class="section-title">Theo từng bộ thẻ</div>
    <div class="bars">
      ${bundles.map((b) => {
        const ids = b.cards.map((c) => c.id);
        const seen = ids.length - newCount(ids);
        const pct = ids.length ? Math.round((seen / ids.length) * 100) : 0;
        const q = quizStat(b.deck.id);
        return `
          <div class="bar-row">
            <span>${esc(b.deck.icon || '')} ${esc(b.deck.title)}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${esc(b.deck.color || 'var(--accent)')}"></span></span>
            <span class="bar-num">${seen}/${ids.length} · ${dueCount(ids)} đến hạn${q.asked ? ` · ${Math.round((q.right / q.asked) * 100)}% đúng` : ''}</span>
          </div>`;
      }).join('')}
    </div>

    <div class="section-title">Luyện nói</div>
    <div class="bars">
      ${(manifest.speaking || []).map((s) => {
        const st = speakStat(s.id);
        const avg = st.tries ? Math.round(st.total / st.tries) : 0;
        return `
          <div class="bar-row">
            <span>${esc(s.icon || '🎤')} ${esc(s.title)}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${avg}%"></span></span>
            <span class="bar-num">${st.tries ? `${st.tries} lượt · trung bình ${avg}` : 'chưa tập'}</span>
          </div>`;
      }).join('')}
    </div>

    <div class="section-title">Sao lưu</div>
    <div class="note-box">
      <div class="btn-row">
        <button class="btn" id="btn-export">Xuất tiến độ ra JSON</button>
        <button class="btn" id="btn-import">Nạp lại từ JSON</button>
        <button class="btn btn-again" id="btn-reset">Xoá sạch tiến độ</button>
      </div>
      <input type="file" id="file-in" accept="application/json" hidden>
      <p style="margin:12px 0 0;font-size:13.5px;color:var(--ink-3)">Tiến độ lưu bằng localStorage. Xoá dữ liệu duyệt web là mất, nên thỉnh thoảng xuất một bản.</p>
    </div>
  `;

  app.querySelector('#btn-export').addEventListener('click', () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `improve-my-self-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const fileIn = app.querySelector('#file-in');
  app.querySelector('#btn-import').addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    if (!f) return;
    try {
      importJSON(await f.text());
      renderStats(app);
    } catch (err) {
      alert(`Không đọc được file: ${err.message}`);
    }
  });

  app.querySelector('#btn-reset').addEventListener('click', () => {
    if (confirm('Xoá toàn bộ tiến độ trên máy này?')) {
      reset();
      renderStats(app);
    }
  });
}
