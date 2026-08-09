// Chuoi hoc hang ngay. Mo may la vao thang day, khong phai chon menu.
// Ba chang noi tiep nhau tren cung mot the trang, khong doi hash, nen bam quay
// lai cua trinh duyet se ra khoi ca chuoi chu khong nhay giua cac chang.

import { loadSelection, loadQuestionsFor, loadSpeakingSet, getManifest } from '../data.js';
import { getPlan, streak, todayCounts } from '../store.js';
import { renderLearn } from './learn.js';
import { renderQuiz } from './quizview.js';
import { runSpeakSession, shuffleSlice } from './speak.js';
import { esc, scoreRing } from '../ui.js';

const STAGE_META = {
  cards: { key: 'cards', name: 'Thẻ khái niệm', icon: '🃏' },
  quiz: { key: 'quiz', name: 'Trắc nghiệm', icon: '🎲' },
  speak: { key: 'speak', name: 'Luyện nói', icon: '🎤' }
};

/** So thu tu cua ngay, dung de xoay bo luyen noi cho khong ngay nao giong ngay nao. */
function dayIndex() {
  const d = new Date();
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

export function planStages(plan) {
  const out = [];
  if (plan.cards > 0) out.push(STAGE_META.cards);
  if (plan.quiz > 0) out.push(STAGE_META.quiz);
  if (plan.speak > 0) out.push(STAGE_META.speak);
  return out;
}

export async function renderToday(app) {
  const plan = getPlan();
  const stages = planStages(plan);

  if (!stages.length) {
    location.hash = '#/plan';
    return;
  }

  app.innerHTML = `<div class="loading">Đang dựng chuỗi hôm nay…</div>`;
  const sel = await loadSelection(plan.decks);

  const summary = { cards: null, quiz: null, speak: null };
  let studied = [];
  let i = 0;

  function chainFor(stage) {
    return {
      stages,
      step: i + 1,
      steps: stages.length,
      key: stage.key,
      onDone: (r) => {
        summary[stage.key] = r;
        i += 1;
        step();
      }
    };
  }

  async function step() {
    // Man truoc con gan phim tat va co the con bat micro. Phai go het truoc khi
    // man sau chiem cho, neu khong phim tat cua chang cu se song ky sinh o chang moi.
    app._cleanup?.();
    app._cleanup = null;

    if (i >= stages.length) return finish();
    const stage = stages[i];
    const chain = chainFor(stage);

    if (stage.key === 'cards') {
      chain.bundle = sel;
      chain.size = plan.cards;
      chain.onDone = (r) => {
        summary.cards = r;
        studied = r.cards || [];
        i += 1;
        step();
      };
      return renderLearn(app, 'plan', chain);
    }

    if (stage.key === 'quiz') {
      app.innerHTML = `<div class="loading">Đang soạn câu hỏi từ những thẻ vừa học…</div>`;
      // Ra de tu chinh nhung the vua lat, chu khong boc lai tu toan kho. Nho vay
      // chang trac nghiem kiem tra dung phan vua hoc, va chi phai tai ngan hang
      // cau hoi cua vai bo lien quan thay vi ca 23 bo.
      const pool = studied.length ? studied : sel.cards;
      const deckIds = [...new Set(pool.map((c) => c.deckId))];
      const authored = await loadQuestionsFor(deckIds);
      chain.bundle = { deck: sel.deck, cards: pool };
      chain.authored = authored;
      chain.size = plan.quiz;
      return renderQuiz(app, 'plan', chain);
    }

    // Luyen noi
    app.innerHTML = `<div class="loading">Đang mở bộ luyện nói…</div>`;
    const manifest = await getManifest();
    const sets = manifest.speaking || [];
    if (!sets.length) {
      summary.speak = null;
      i += 1;
      return step();
    }
    let setId = plan.speakSet;
    if (setId === 'auto' || !sets.some((s) => s.id === setId)) {
      setId = sets[dayIndex() % sets.length].id;
    }
    const { meta, drills } = await loadSpeakingSet(setId);
    if (!drills.length) {
      i += 1;
      return step();
    }
    return runSpeakSession(app, {
      id: setId,
      title: meta.title,
      icon: meta.icon || '🎤',
      blurb: meta.blurb || '',
      backHref: '#/plan',
      backLabel: 'Chuỗi hôm nay',
      items: shuffleSlice(drills, plan.speak),
      size: plan.speak,
      total: drills.length,
      unit: 'tình huống của bộ',
      rerun: () => renderToday(app),
      chain
    });
  }

  function finish() {
    const days = streak();
    const c = summary.cards;
    const q = summary.quiz;
    const s = summary.speak;

    app.innerHTML = `
      <div class="done-hero">
        <div class="big">🔥</div>
        <h2>Xong chuỗi hôm nay</h2>
        <p>${days > 1
          ? `Đây là ngày thứ ${days} liên tiếp bạn không bỏ buổi nào.`
          : 'Ngày đầu của chuỗi. Quay lại vào mai là thành hai.'}</p>

        <div class="grid grid-stats" style="max-width:640px;margin:0 auto 22px">
          ${c ? `<div class="stat"><div class="stat-value">${c.total}</div><div class="stat-label">thẻ đã lật · thuộc ${c.good}</div></div>` : ''}
          ${q ? `<div class="stat"><div class="stat-value">${q.right}/${q.total}</div><div class="stat-label">câu trắc nghiệm đúng</div></div>` : ''}
          ${s ? `<div class="stat"><div class="stat-value">${s.avg}</div><div class="stat-label">điểm nói trung bình</div></div>` : ''}
        </div>

        ${q && q.pct != null ? `<div style="display:flex;justify-content:center;margin-bottom:18px">${scoreRing(q.pct)}</div>` : ''}

        ${q && q.wrongOnes?.length ? `
          <div class="note-box" style="text-align:left;max-width:640px;margin:0 auto 20px">
            <strong>Cần xem lại:</strong>
            <ul style="margin:8px 0 0;padding-left:20px">
              ${q.wrongOnes.map((w) => `<li>${esc(w)}</li>`).join('')}
            </ul>
          </div>` : ''}

        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-primary" id="btn-more">Chạy thêm một chuỗi nữa</button>
          <a class="btn" href="#/plan">Sửa chuỗi</a>
          <a class="btn btn-ghost" href="#/">Về trang chính</a>
        </div>
      </div>`;

    app.querySelector('#btn-more')?.addEventListener('click', () => renderToday(app));
  }

  step();
}

/** Tien do hom nay so voi ke hoach, dung cho ca trang #/plan lan trang chinh. */
export function todayProgress(plan = getPlan()) {
  const d = todayCounts();
  const rows = [
    { key: 'cards', label: 'thẻ khái niệm', done: d.learn, goal: plan.cards },
    { key: 'quiz', label: 'câu trắc nghiệm', done: d.quiz, goal: plan.quiz },
    { key: 'speak', label: 'lượt nói', done: d.speak, goal: plan.speak }
  ].filter((r) => r.goal > 0);
  const all = rows.length > 0 && rows.every((r) => r.done >= r.goal);
  return { rows, allDone: all };
}
