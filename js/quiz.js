// Sinh cau hoi trac nghiem tu chinh bo the, tron voi ngan hang cau hoi viet tay.
// Nho vay moi lan them mot the la kho cau hoi tu day them, khong phai soan rieng.

export function shuffle(list, rnd = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickDistractors(card, pool, field, n = 3) {
  const wanted = String(card[field] || '').trim();
  const sameTag = pool.filter(
    (c) => c.id !== card.id && c.tags.some((t) => card.tags.includes(t)) && String(c[field] || '').trim() && String(c[field]).trim() !== wanted
  );
  const others = pool.filter(
    (c) => c.id !== card.id && String(c[field] || '').trim() && String(c[field]).trim() !== wanted
  );
  const seen = new Set();
  const out = [];
  for (const c of [...shuffle(sameTag), ...shuffle(others)]) {
    const v = String(c[field]).trim();
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length === n) break;
  }
  return out;
}

const TEMPLATES = [
  {
    id: 'head2gloss',
    need: (c) => c.head && c.gloss,
    field: 'gloss',
    build: (c) => ({
      q: `"${c.head}" nghĩa tiếng Việt là gì?`,
      correct: c.gloss
    })
  },
  {
    id: 'gloss2head',
    need: (c) => c.head && c.gloss,
    field: 'head',
    build: (c) => ({
      q: `Thuật ngữ nào tương ứng với "${c.gloss}"?`,
      correct: c.head
    })
  },
  {
    id: 'defA2head',
    need: (c) => c.head && c.defA,
    field: 'head',
    build: (c) => ({
      q: c.defA,
      qHint: 'Định nghĩa này nói về thuật ngữ nào?',
      correct: c.head
    })
  },
  {
    id: 'defB2head',
    need: (c) => c.head && c.defB,
    field: 'head',
    build: (c) => ({
      q: c.defB,
      qHint: 'Định nghĩa này nói về thuật ngữ nào?',
      correct: c.head
    })
  }
];

/**
 * Nhung mat truoc va nhung nghia xuat hien o HAI the tro len voi noi dung khac
 * nhau. Vai thuat ngu nam o nhieu bo la co chu y, vi du prompt injection vua
 * thuoc AI vua thuoc an ninh, moi bo nhin mot goc. Nhung khi tron ca kho de ra
 * de thi chung sinh ra cau KHONG CO dap an dung duy nhat:
 *
 *   "prompt injection nghia tieng Viet la gi?"
 *   A. tiem nhiem loi nhac   B. chen chi thi doc vao dau vao
 *
 * Ca hai deu dung, nhung chi mot cai duoc cham. Nen phai bo dung nhung mau cau
 * bi nhap nhang do, chu khong phai bo the.
 */
function ambiguous(pool, field) {
  const thay = new Map();
  for (const c of pool) {
    const k = String(c[field] || '').trim().toLowerCase();
    if (!k) continue;
    if (!thay.has(k)) thay.set(k, new Set());
    thay.get(k).add(String(c[field === 'head' ? 'gloss' : 'head'] || '').trim().toLowerCase());
  }
  const out = new Set();
  for (const [k, v] of thay) if (v.size > 1) out.add(k);
  return out;
}

/** Sinh mot cau hoi tu vung tu the da cho. Tra ve null neu the thieu du lieu. */
export function questionFromCard(card, pool, mo = null) {
  const nhapNhang = mo || { head: ambiguous(pool, 'head'), gloss: ambiguous(pool, 'gloss') };
  const headMo = nhapNhang.head.has(String(card.head || '').trim().toLowerCase());
  const glossMo = nhapNhang.gloss.has(String(card.gloss || '').trim().toLowerCase());

  const usable = TEMPLATES.filter((t) => {
    if (!t.need(card)) return false;
    // head2gloss hoi tu mat truoc ra nghia, nen hong khi mat truoc nhap nhang.
    if (t.id === 'head2gloss' && headMo) return false;
    // gloss2head hoi nguoc lai, nen hong khi nghia nhap nhang.
    if (t.id === 'gloss2head' && glossMo) return false;
    return true;
  });
  if (!usable.length) return null;
  const tpl = usable[Math.floor(Math.random() * usable.length)];
  const distractors = pickDistractors(card, pool, tpl.field, 3);
  if (distractors.length < 2) return null;

  const built = tpl.build(card);
  const choices = shuffle([built.correct, ...distractors]);
  return {
    id: `gen-${card.id}-${tpl.id}`,
    generated: true,
    cardId: card.id,
    deckId: card.deckId,
    q: built.q,
    q_vi: built.qHint || '',
    choices,
    answer: choices.indexOf(built.correct),
    why: card.defA || '',
    why_vi: card.defB || '',
    term: card.head,
    gloss: card.gloss
  };
}

/**
 * Bo cau hoi cho mot phien: uu tien cau viet tay, bu them cau sinh tu the.
 */
export function buildQuizSet({ cards, authored, size = 12, mix = 0.5 }) {
  const handCount = Math.min(authored.length, Math.round(size * mix));
  const hand = shuffle(authored).slice(0, handCount);

  // Tinh mot lan cho ca luot, khong tinh lai o tung the: kho co hon ba nghin the
  // nen quet lai moi lan se cham thay ro tren dien thoai.
  const mo = { head: ambiguous(cards, 'head'), gloss: ambiguous(cards, 'gloss') };

  const generated = [];
  for (const card of shuffle(cards)) {
    if (hand.length + generated.length >= size) break;
    const q = questionFromCard(card, cards, mo);
    if (q) generated.push(q);
  }
  return shuffle([...hand, ...generated]);
}
