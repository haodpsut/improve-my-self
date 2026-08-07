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

/** Sinh mot cau hoi tu vung tu the da cho. Tra ve null neu the thieu du lieu. */
export function questionFromCard(card, pool) {
  const usable = TEMPLATES.filter((t) => t.need(card));
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

  const generated = [];
  for (const card of shuffle(cards)) {
    if (hand.length + generated.length >= size) break;
    const q = questionFromCard(card, cards);
    if (q) generated.push(q);
  }
  return shuffle([...hand, ...generated]);
}
