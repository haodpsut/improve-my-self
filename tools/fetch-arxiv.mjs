// Lay bai moi nhat tu arXiv, chia thanh hai lat theo chu de.
// Chay: npm run arxiv
//
// Muc dich: dua NGUON THAT vao tay agent soan the, thay vi de no viet theo
// tri nho, vi kien thuc cua mo hinh dung o thang 5 nam 2026.

import { writeFileSync } from 'node:fs';

const API = 'https://export.arxiv.org/api/query';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parse(xml) {
  const out = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const pick = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(e);
      return r ? r[1] : '';
    };
    const un = (s) => s
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').trim();

    const id = un(pick('id')).split('/abs/').pop();
    const cats = [...e.matchAll(/<category term="([^"]+)"/g)].map((c) => c[1]);
    out.push({
      id,
      date: un(pick('published')).slice(0, 10),
      title: un(pick('title')),
      summary: un(pick('summary')).slice(0, 900),
      cats: [...new Set(cats)].slice(0, 4)
    });
  }
  return out;
}

async function query(searchQuery, max = 150) {
  const url = `${API}?search_query=${encodeURIComponent(searchQuery)}`
    + `&sortBy=submittedDate&sortOrder=descending&max_results=${max}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`arXiv trả về HTTP ${res.status} cho: ${searchQuery}`);
  return parse(await res.text());
}

const SLICES = {
  llm: [
    'cat:cs.CL',
    'cat:cs.LG AND abs:"language model"',
    'abs:"reasoning model" OR abs:"test-time compute" OR abs:"inference-time"',
    'abs:"mixture of experts" OR abs:"long context" OR abs:"KV cache"'
  ],
  agent: [
    'cat:cs.MA',
    'abs:"LLM agent" OR abs:"agentic"',
    'abs:"prompt injection" OR abs:"tool use" OR abs:"tool calling"',
    'cat:cs.CR AND abs:"agent"'
  ]
};

const result = {};

for (const [slice, queries] of Object.entries(SLICES)) {
  const seen = new Map();
  for (const q of queries) {
    let batch = [];
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try { batch = await query(q); break; }
      catch (e) { console.log(`  thử lại ${attempt}/3 cho "${q}": ${e.message}`); await sleep(4000); }
    }
    for (const p of batch) if (!seen.has(p.id)) seen.set(p.id, p);
    console.log(`  ${slice} | ${q} | lấy ${batch.length}, tổng dồn ${seen.size}`);
    await sleep(3500); // arXiv de nghi cho it nhat ba giay giua hai lan goi
  }
  const list = [...seen.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  result[slice] = list;
  writeFileSync(`tools/arxiv-${slice}.json`, JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), count: list.length, papers: list }, null, 1), 'utf8');
}

for (const [k, v] of Object.entries(result)) {
  const days = [...new Set(v.map((p) => p.date))].sort().reverse();
  console.log(`\n${k}: ${v.length} bài, mới nhất ${days[0]}, cũ nhất ${days[days.length - 1]}`);
  console.log('  ví dụ:', v.slice(0, 3).map((p) => p.title.slice(0, 60)).join(' | '));
}
