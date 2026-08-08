// Nap va chuan hoa toan bo du lieu JSON trong data/.
// Khong co API, khong co build. Sua JSON la trang doi theo.

const cache = new Map();

async function getJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Không tải được ${path} (HTTP ${res.status})`);
  const json = await res.json();
  cache.set(path, json);
  return json;
}

let manifestPromise = null;

export function getManifest() {
  if (!manifestPromise) manifestPromise = getJSON('data/manifest.json');
  return manifestPromise;
}

/**
 * Chuan hoa mot the ve dang chung, bat ke bo the thuoc cap ngon ngu nao.
 * head   = mat truoc (tieng Anh, hoac tieng Nga voi bo russian)
 * gloss  = nghia tieng Viet ngan
 * defA   = dinh nghia bang ngon ngu cua mat truoc
 * defB   = dinh nghia tieng Viet
 */
export function normaliseCard(raw, deck) {
  const isRu = deck.lang === 'ru-vi';
  return {
    id: raw.id,
    deckId: deck.id,
    deckTitle: deck.title,
    deckColor: deck.color,
    deckIcon: deck.icon,
    lang: deck.lang,
    head: isRu ? raw.ru : raw.en,
    headLang: isRu ? 'ru-RU' : 'en-US',
    gloss: raw.vi || '',
    translit: raw.translit || '',
    ipa: raw.ipa || '',
    altEn: isRu ? raw.en || '' : '',
    defA: (isRu ? raw.def_ru : raw.def_en) || '',
    defB: raw.def_vi || '',
    say: raw.say || '',
    tags: raw.tags || [],
    raw
  };
}

export async function loadDeck(deckId) {
  const manifest = await getManifest();
  const deck = manifest.decks.find((d) => d.id === deckId);
  if (!deck) throw new Error(`Không có bộ thẻ "${deckId}" trong manifest.`);
  const file = await getJSON(deck.file);
  const cards = (file.cards || []).map((c) => normaliseCard(c, deck));
  return { deck, cards, updated: file.updated || manifest.updated };
}

export async function loadAllDecks() {
  const manifest = await getManifest();
  return Promise.all(manifest.decks.map((d) => loadDeck(d.id)));
}

/**
 * Gop moi bo the thanh mot bo ao de on tong hop.
 * The da mang san deckTitle va deckIcon nen van biet no den tu bo nao.
 */
export async function loadEverything() {
  const bundles = await loadAllDecks();
  return {
    deck: {
      id: 'all',
      title: 'Ôn tổng hợp',
      title_en: 'Mixed review across every deck',
      icon: '🗓️',
      lang: 'en-vi',
      blurb: 'Thẻ đến hạn của mọi bộ, trộn lại thành một lượt.',
      color: '#6ea8fe'
    },
    cards: bundles.flatMap((b) => b.cards)
  };
}

export async function loadQuestions(deckId) {
  const manifest = await getManifest();
  const entry = (manifest.quizzes || []).find((q) => q.deck === deckId);
  if (!entry) return [];
  try {
    const file = await getJSON(entry.file);
    return (file.questions || []).map((q) => ({ ...q, deckId }));
  } catch (err) {
    console.warn('Bỏ qua ngân hàng câu hỏi lỗi:', entry.file, err);
    return [];
  }
}

/** Moi cau hoi viet tay cua moi mon, dung cho bai trac nghiem tong hop. */
export async function loadAllQuestions() {
  const manifest = await getManifest();
  const lists = await Promise.all((manifest.quizzes || []).map((q) => loadQuestions(q.deck)));
  return lists.flat();
}

export async function loadSpeakingSet(setId) {
  const manifest = await getManifest();
  const entry = (manifest.speaking || []).find((s) => s.id === setId);
  if (!entry) throw new Error(`Không có bộ luyện nói "${setId}".`);
  const file = await getJSON(entry.file);
  return { meta: entry, drills: file.drills || [] };
}

export async function loadAllSpeakingSets() {
  const manifest = await getManifest();
  return Promise.all((manifest.speaking || []).map((s) => loadSpeakingSet(s.id)));
}
