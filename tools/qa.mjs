#!/usr/bin/env node
// Cong QA dong bo. Chay: node tools/qa.mjs
//
// Khac voi check-data.mjs, cong nay khong chi kiem tinh hop le cua du lieu.
// No kiem nhung duong ma nguoi hoc co the DOAN ma khong can biet gi,
// va nhung dau hieu cho thay van ban bi hong am tham.
//
// Chay ca hai truoc khi day len: check-data.mjs bat loi cau truc,
// qa.mjs bat loi chat luong.

import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fail = [];
const warn = [];

async function readJSON(rel) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) { fail.push(`${rel}: không tồn tại`); return null; }
  try { return JSON.parse(await readFile(abs, 'utf8')); }
  catch (e) { fail.push(`${rel}: JSON hỏng, ${e.message}`); return null; }
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();

// Rieng khi so hai LUA CHON co trung nhau khong thi PHAI giu dau cau.
// Bo the cum tu co nhung cau lay chinh dau noi lam diem phan biet, vi du
// "follow up email" so voi "follow-up email". Dung norm() o day se gop hai
// phuong an khac nhau that thanh mot va bao loi oan.
const normChoice = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Cac tu that su khong the dung cuoi cau.
//
// Hai bay da mac phai, ghi lai de dung lap:
//  1. Tieng Anh CHO PHEP ket cau bang gioi tu ("the path it travels on"), nen
//     khong duoc liet ke gioi tu, neu khong se bao dong gia hang loat.
//  2. Mao tu phai kiem PHAN BIET HOA THUONG. Chu "A" viet hoa cuoi cau thuong
//     la nhan, vi du "the notebooks of group A", khong phai mao tu bo lung.
const DANGLING_CONJ = /\b(?:and|or|but|because|which|than)\s*$/i;
const DANGLING_ART = /\b(?:the|a|an|its|their|our|your)\s*$/;
const isDangling = (s) => DANGLING_CONJ.test(s) || DANGLING_ART.test(s);

const manifest = await readJSON('data/manifest.json');
if (!manifest) { console.error('Không đọc được manifest.'); process.exit(1); }

/* ---------------------------------------------------------------
   1. Bo the
   --------------------------------------------------------------- */
// Ngay moi nhat trong toan bo file du lieu. Dau phien ban o chan trang lay tu
// manifest.updated, nen no khong duoc phep cu hon con so nay.
let newestData = '';
const noteDate = (f) => { if (f?.updated && f.updated > newestData) newestData = f.updated; };

const cardRows = [];
const allCardIds = new Set();
// Mat truoc tren TOAN KHO, de biet thuat ngu nao nam o nhieu bo.
// Nam o nhieu bo khong phai loi: prompt injection vua thuoc AI vua thuoc an ninh.
// Nhung neu hai the cung mat truoc ma khac nghia thi bai tron ca kho se sinh ra
// cau hoi khong co dap an dung duy nhat, nen phai in ra de con nhin thay.
const headMap = new Map();

for (const deck of manifest.decks || []) {
  const file = await readJSON(deck.file);
  if (!file) continue;
  noteDate(file);
  const cards = file.cards || [];
  const heads = new Map();
  let withSay = 0;

  for (const c of cards) {
    if (allCardIds.has(c.id)) fail.push(`${deck.file}: id thẻ trùng trên toàn kho, "${c.id}"`);
    allCardIds.add(c.id);

    const head = deck.lang === 'ru-vi' ? c.ru : c.en;
    const key = norm(head);
    if (heads.has(key)) fail.push(`${deck.file}: hai thẻ cùng mặt trước "${head}" (${heads.get(key)} và ${c.id})`);
    heads.set(key, c.id);
    if (!headMap.has(key)) headMap.set(key, []);
    headMap.get(key).push({ deck: deck.id, head, gloss: norm(c.vi) });

    // Bo tieng Nga khong dung truong say, cau doc thanh tieng cua no la def_ru.
    const readable = deck.lang === 'ru-vi' ? c.def_ru : c.say;
    if (readable) withSay += 1;
    if (c.say) {
      // Cau doc thanh tieng ma con chu so thi may doc sai nhip.
      if (/\d/.test(c.say)) warn.push(`${deck.file}: thẻ "${c.id}" có chữ số trong câu đọc thành tiếng, nên viết thành chữ`);
      if (isDangling(c.say.trim())) fail.push(`${deck.file}: thẻ "${c.id}" câu ví dụ kết thúc lửng`);
    }
    if (norm(c.vi) === norm(head)) warn.push(`${deck.file}: thẻ "${c.id}" nghĩa tiếng Việt trùng mặt trước`);

    // Nguon phai la ma arXiv that, vi ca diem manh cua the co nguon la truy nguoc duoc.
    if (c.src !== undefined) {
      if (!Array.isArray(c.src)) fail.push(`${deck.file}: thẻ "${c.id}" trường src phải là mảng`);
      else for (const s of c.src) {
        if (!/^\d{4}\.\d{4,5}(v\d+)?$/.test(String(s))) {
          fail.push(`${deck.file}: thẻ "${c.id}" mã nguồn "${s}" không đúng dạng mã arXiv`);
        }
      }
    }
    if (deck.id.startsWith('arxiv-') && !(c.src || []).length) {
      fail.push(`${deck.file}: thẻ "${c.id}" thuộc bộ đọc từ arXiv nhưng không dẫn nguồn nào`);
    }
  }

  cardRows.push({ deck: deck.id, n: cards.length, say: withSay, sayPct: pct(withSay, cards.length) });
  if (!cards.length) fail.push(`${deck.file}: bộ thẻ rỗng`);
}

/* ---------------------------------------------------------------
   2. Ngan hang cau hoi: cac duong doan mo
   --------------------------------------------------------------- */
const qRows = [];

for (const quiz of manifest.quizzes || []) {
  const file = await readJSON(quiz.file);
  if (!file) continue;
  noteDate(file);
  const qs = file.questions || [];
  if (qs.length < 100) warn.push(`${quiz.file}: mới có ${qs.length} câu, mốc đặt ra là 100`);

  const posCount = [0, 0, 0, 0];
  const rankCount = [0, 0, 0, 0];
  let ties = 0;
  const stems = new Map();

  for (const q of qs) {
    const ch = q.choices || [];
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= ch.length) {
      fail.push(`${quiz.file}: câu "${q.id}" chỉ số đáp án ngoài khoảng`);
      continue;
    }
    posCount[Math.min(q.answer, 3)] += 1;

    const len = ch.map((c) => String(c).length);
    const sorted = [...len].sort((a, b) => b - a);
    rankCount[Math.min(sorted.indexOf(len[q.answer]), 3)] += 1;
    if (new Set(len).size !== len.length) ties += 1;

    const stem = norm(q.q);
    if (stems.has(stem)) fail.push(`${quiz.file}: hai câu cùng đề bài, "${q.id}" và "${stems.get(stem)}"`);
    stems.set(stem, q.id);

    for (const c of ch) {
      const s = String(c).trim();
      if (!s) fail.push(`${quiz.file}: câu "${q.id}" có lựa chọn rỗng`);
      if (isDangling(s)) fail.push(`${quiz.file}: câu "${q.id}" có lựa chọn kết thúc lửng, "${s.slice(-45)}"`);
    }
    if (new Set(ch.map(normChoice)).size !== ch.length) {
      fail.push(`${quiz.file}: câu "${q.id}" có hai lựa chọn giống nhau về nội dung`);
    }
    // Giai thich tro theo vi tri se sai ngay khi ai do hoan vi lua chon.
    if (/(the (first|second|third|last|final) (option|choice))|(phương án|lựa chọn) (đầu|hai|thứ hai|thứ ba|cuối)/i.test(`${q.why} ${q.why_vi}`)) {
      fail.push(`${quiz.file}: câu "${q.id}" giải thích tham chiếu theo vị trí phương án`);
    }
  }

  const n = qs.length || 1;
  const posPct = posCount.map((v) => pct(v, n));
  const rankPct = rankCount.map((v) => pct(v, n));

  // Ba duong doan mo, moi duong deu bien bai trac nghiem thanh vo nghia.
  const maxPos = Math.max(...posPct);
  if (maxPos > 40) fail.push(`${quiz.id}: đáp án dồn về một vị trí, ${maxPos} phần trăm, cứ chọn vị trí đó là đúng`);
  const maxRank = Math.max(...rankPct);
  if (maxRank > 40) fail.push(`${quiz.id}: đáp án dồn về một hạng độ dài, ${maxRank} phần trăm, đoán theo độ dài là ăn điểm`);
  if (pct(ties, n) > 25) warn.push(`${quiz.id}: ${pct(ties, n)} phần trăm số câu có hai lựa chọn dài bằng nhau, phép đo hạng kém tin cậy`);

  qRows.push({ id: quiz.deck, n: qs.length, pos: posPct.join('/'), rank: rankPct.join('/'), maxPos, maxRank });
}

/* ---------------------------------------------------------------
   3. Bo luyen noi
   --------------------------------------------------------------- */
const sRows = [];

for (const set of manifest.speaking || []) {
  const file = await readJSON(set.file);
  if (!file) continue;
  noteDate(file);
  const drills = file.drills || [];
  if (drills.length < 100) warn.push(`${set.file}: mới có ${drills.length} tình huống, mốc đặt ra là 100`);

  const ids = new Set();
  let keyless = 0;
  let wordSum = 0;

  for (const d of drills) {
    if (ids.has(d.id)) fail.push(`${set.file}: id tình huống trùng, "${d.id}"`);
    ids.add(d.id);
    if (!d.target) { fail.push(`${set.file}: tình huống "${d.id}" thiếu câu mẫu`); continue; }

    const words = String(d.target).trim().split(/\s+/).length;
    wordSum += words;
    if (words > 60) warn.push(`${set.file}: tình huống "${d.id}" câu mẫu dài ${words} từ, khó bật ra`);

    const t = String(d.target).toLowerCase();
    const keys = Array.isArray(d.keys) ? d.keys : [];
    if (!keys.length) keyless += 1;
    for (const k of keys) {
      // Cum khoa khong nam trong cau mau thi bai do khong bao gio dat diem toi da.
      if (!t.includes(String(k).toLowerCase())) {
        fail.push(`${set.file}: tình huống "${d.id}" cụm khoá "${k}" không nằm trong câu mẫu`);
      }
    }
    if (/\d/.test(d.target) || /\d/.test(d.prompt || '')) {
      warn.push(`${set.file}: tình huống "${d.id}" còn chữ số, máy đọc lên sẽ lệch nhịp`);
    }
    if (!d.tip) warn.push(`${set.file}: tình huống "${d.id}" chưa có lời nhắc`);
  }

  if (drills.length && pct(keyless, drills.length) > 20) {
    warn.push(`${set.file}: ${pct(keyless, drills.length)} phần trăm tình huống không có cụm khoá nào, phần chấm chỉ còn dựa vào trùng từ`);
  }
  sRows.push({ id: set.id, n: drills.length, avgWords: Math.round(wordSum / (drills.length || 1)) });
}

/* ---------------------------------------------------------------
   Cai len dien thoai: danh sach tai truoc, bieu tuong, loi tat
   ---------------------------------------------------------------
   Service worker tai truoc mot danh sach duong dan viet tay. Doi ten mot tep js
   ma quen sua danh sach do thi trang van chay binh thuong khi CO mang, va chi
   hong khi mat mang, tuc la hong o dung luc khong ai kiem tra duoc. Nen phai
   kiem tu dong. Chieu nguoc lai cung phai kiem: co tep js moi ma khong ghi vao
   danh sach thi ban ngoai tuyen se thieu dung tep do. */

const swSrc = existsSync(path.join(ROOT, 'sw.js')) ? await readFile(path.join(ROOT, 'sw.js'), 'utf8') : '';
if (!swSrc) {
  fail.push('sw.js: không tồn tại, trang sẽ không cài lên điện thoại được');
} else {
  const block = swSrc.match(/const SHELL = \[([\s\S]*?)\];/);
  if (!block) {
    fail.push('sw.js: không tìm thấy danh sách SHELL để đối chiếu');
  } else {
    const listed = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    for (const rel of listed) {
      if (rel === './') continue;
      if (!existsSync(path.join(ROOT, rel))) {
        fail.push(`sw.js: tải trước "${rel}" nhưng tệp không tồn tại, bản ngoại tuyến sẽ thiếu`);
      }
    }
    // Moi tep js phai co trong danh sach, neu khong thi mat mang la trang gay.
    const jsFiles = [];
    const walk = (dir) => {
      for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (e.name.endsWith('.js')) jsFiles.push(rel);
      }
    };
    walk('js');
    for (const f of jsFiles) {
      if (!listed.includes(f)) fail.push(`sw.js: thiếu "${f}" trong danh sách tải trước, mất mạng sẽ hỏng đúng trang dùng tệp này`);
    }
  }
}

// Dau ban o chan trang phai khop VERSION cua service worker. Neu lech, chan trang
// se noi mot dang con ban luu tren may la mot dang khac, dung kieu nham lan da
// tung ton mot buoi de tim ra.
const indexSrc = existsSync(path.join(ROOT, 'index.html')) ? await readFile(path.join(ROOT, 'index.html'), 'utf8') : '';
const metaBuild = indexSrc.match(/<meta name="build" content="([^"]+)"/)?.[1] || null;
const swVersion = swSrc.match(/const VERSION = '([^']+)'/)?.[1] || null;
if (!metaBuild) fail.push('index.html: thiếu <meta name="build">, chân trang sẽ không nói được đang chạy bản nào');
else if (!swVersion) fail.push('sw.js: không đọc được VERSION để đối chiếu với dấu bản ở chân trang');
else if (metaBuild !== swVersion) {
  fail.push(`dấu bản lệch: index.html ghi "${metaBuild}" còn sw.js ghi "${swVersion}", sửa mã nguồn mà quên đổi một trong hai`);
}

const webmanifest = await readJSON('site.webmanifest');
if (webmanifest) {
  for (const ic of webmanifest.icons || []) {
    if (!existsSync(path.join(ROOT, ic.src))) fail.push(`site.webmanifest: biểu tượng "${ic.src}" không tồn tại`);
  }
  const maskable = (webmanifest.icons || []).some((i) => String(i.purpose || '').includes('maskable'));
  if (!maskable) fail.push('site.webmanifest: chưa có biểu tượng maskable, Android sẽ cắt mất góc của biểu tượng');
  // 192 va 512 la hai co Android that su lay: 192 dat len man hinh chinh, 512 dung
  // cho man hinh mo dau.
  //
  // ĐÍNH CHÍNH cho chinh minh: toi tung ghi o day rang thieu 192 thi Chrome KHONG
  // BAO GIO moi cai. Do lai bang cach bo han bieu tuong 192 roi nghe su kien
  // beforeinstallprompt, thi no VAN no. Chrome doi mot bieu tuong tu 144 tro len
  // chu khong doi dung 192. Giu phep kiem nay vi de he dieu hanh tu thu nho ban
  // 512 se ra bieu tuong mo, chu khong phai vi no chan viec cai.
  const pngSizes = new Set((webmanifest.icons || [])
    .filter((i) => i.type === 'image/png')
    .flatMap((i) => String(i.sizes || '').split(/\s+/)));
  for (const need of ['192x192', '512x512']) {
    if (!pngSizes.has(need)) fail.push(`site.webmanifest: thiếu biểu tượng PNG ${need}, hệ điều hành sẽ phải tự thu nhỏ bản khác và biểu tượng sẽ mờ`);
  }
  // Loi tat va cua vao deu la duong dan bam. Sai mot chu la mo ra trang trong.
  const KNOWN = ['/', '/start', '/today', '/plan', '/browse', '/stats'];
  const okRoute = (u) => {
    const h = String(u).split('#')[1] || '/';
    return KNOWN.includes(h) || /^\/(deck|learn|quiz|say|speak|browse)\/[\w-]+$/.test(h);
  };
  if (!okRoute(webmanifest.start_url)) fail.push(`site.webmanifest: start_url "${webmanifest.start_url}" không khớp đường dẫn nào của trang`);
  for (const sc of webmanifest.shortcuts || []) {
    if (!okRoute(sc.url)) fail.push(`site.webmanifest: lối tắt "${sc.name}" trỏ tới "${sc.url}" không khớp đường dẫn nào`);
  }
}

/* ---------------------------------------------------------------
   Thuat ngu nam o nhieu bo
   ---------------------------------------------------------------
   Chi CANH BAO chu khong chan, vi mot thuat ngu nam o hai bo thuong la co chu y.
   Nhung phai in ra: bai tron ca kho lay the tu moi bo, va neu hai the cung mat
   truoc ma khac nghia thi mau cau hoi nghia se co hai dap an dung ma chi mot cai
   duoc cham. Bo sinh cau hoi da duoc day bo qua nhung the nhu vay, va con so o
   day cho biet no dang phai bo bao nhieu. */

const chungMat = [...headMap.entries()].filter(([, ds]) => ds.length > 1);
const khacNghia = chungMat.filter(([, ds]) => new Set(ds.map((d) => d.gloss)).size > 1);
if (chungMat.length) {
  warn.push(`${chungMat.length} thuật ngữ nằm ở nhiều bộ, trong đó ${khacNghia.length} thuật ngữ mang nghĩa khác nhau giữa các bộ`);
  for (const [, ds] of khacNghia.slice(0, 6)) {
    warn.push(`  "${ds[0].head}" ở ${ds.map((d) => d.deck).join(', ')} với nghĩa khác nhau, bài trộn sẽ bỏ mẫu hỏi nghĩa của thẻ này`);
  }
}

/* ---------------------------------------------------------------
   Tep cai Android
   ---------------------------------------------------------------
   Trang ke hoach co mot nut tai tep .apk. Neu tep do khong co that thi nut van
   hien binh thuong va chi bao loi luc nguoi dung bam, tuc la o dung luc te nhat.
   Va neu co apk ma thieu assetlinks thi ung dung van chay, chi la chay kem mot
   thanh dia chi cua trinh duyet, dieu rat de bo qua khi thu tren may minh. */

const planSrc = existsSync(path.join(ROOT, 'js/views/plan.js'))
  ? await readFile(path.join(ROOT, 'js/views/plan.js'), 'utf8') : '';
const apkRef = planSrc.match(/href="(app\/[^"]+\.apk)"/)?.[1] || null;
if (apkRef) {
  if (!existsSync(path.join(ROOT, apkRef))) {
    fail.push(`js/views/plan.js: nút tải trỏ tới "${apkRef}" nhưng tệp không có trong kho, bấm vào sẽ ra trang lỗi`);
  }
  const alPath = path.join(ROOT, '.well-known/assetlinks.json');
  if (!existsSync(alPath)) {
    fail.push('.well-known/assetlinks.json: thiếu, ứng dụng Android sẽ mở kèm thanh địa chỉ của trình duyệt');
  } else {
    const al = JSON.parse(await readFile(alPath, 'utf8'));
    const fp = al?.[0]?.target?.sha256_cert_fingerprints?.[0] || '';
    if (!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fp)) {
      fail.push('.well-known/assetlinks.json: vân tay SHA-256 sai dạng, phải là 32 cặp ký tự hoa nối bằng dấu hai chấm');
    }
    if (!al?.[0]?.target?.package_name) {
      fail.push('.well-known/assetlinks.json: thiếu package_name');
    }
  }
}

/* ---------------------------------------------------------------
   Bao cao
   --------------------------------------------------------------- */
const line = (s) => console.log(s);

line('\nBỘ THẺ');
line('  bộ              thẻ   có câu đọc');
for (const r of cardRows) line(`  ${r.deck.padEnd(15)}${String(r.n).padStart(4)}${(r.sayPct + '%').padStart(12)}`);
line(`  tổng cộng      ${String(cardRows.reduce((a, r) => a + r.n, 0)).padStart(4)}`);

line('\nNGÂN HÀNG CÂU HỎI  (vị trí và hạng độ dài, lý tưởng 25/25/25/25)');
line('  bộ              câu   vị trí A/B/C/D      hạng dài 1/2/3/4');
for (const r of qRows) line(`  ${r.id.padEnd(15)}${String(r.n).padStart(4)}   ${r.pos.padEnd(18)} ${r.rank}`);
line(`  tổng cộng      ${String(qRows.reduce((a, r) => a + r.n, 0)).padStart(4)}`);

line('\nLUYỆN NÓI');
line('  bộ              tình huống   độ dài câu mẫu trung bình');
for (const r of sRows) line(`  ${r.id.padEnd(15)}${String(r.n).padStart(10)}${String(r.avgWords + ' từ').padStart(22)}`);
line(`  tổng cộng      ${String(sRows.reduce((a, r) => a + r.n, 0)).padStart(10)}`);

// Dau phien ban o chan trang doc tu manifest.updated. Neu no cu hon du lieu that
// thi nguoi dung se tuong minh dang o ban cu, dung loai nham lan da xay ra.
if (newestData && (!manifest.updated || manifest.updated < newestData)) {
  fail.push(`manifest.updated là ${manifest.updated || 'trống'} nhưng dữ liệu mới nhất là ${newestData}, dấu phiên bản ở chân trang sẽ nói sai ngày`);
}

if (warn.length) {
  line(`\nCẢNH BÁO (${warn.length})`);
  warn.slice(0, 30).forEach((w) => line('  ! ' + w));
  if (warn.length > 30) line(`  … còn ${warn.length - 30} cảnh báo nữa`);
}

if (fail.length) {
  line(`\nKHÔNG ĐẠT (${fail.length})`);
  fail.slice(0, 50).forEach((f) => line('  x ' + f));
  if (fail.length > 50) line(`  … còn ${fail.length - 50} lỗi nữa`);
  line('');
  process.exit(1);
}

line('\nQA đồng bộ: đạt.\n');
