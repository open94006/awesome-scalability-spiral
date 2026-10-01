// 內容檢查：課程是否完整涵蓋上游目錄、每課格式是否正確、文字是否全為繁體中文（台灣用語）。
// 用法：node scripts/check-content.mjs（需要 Node 22.18 以上，可直接載入 .ts）
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const files = ['knowledge', 'habit', 'skill-data', 'skill-flow', 'skill-ops', 'skill-perf', 'skill-intel', 'wisdom'];
const units = (await Promise.all(files.map((f) => import(new URL(`src/curriculum/${f}.ts`, root))))).flatMap((m) => Object.values(m)[0]);
const { links } = JSON.parse(readFileSync(new URL('src/data/links.json', root), 'utf8'));
const bases = JSON.parse(readFileSync(new URL('src/data/lesson-meta.json', root), 'utf8'));
const errors = [];
const warnings = [];
const warn = (url, msg) => warnings.push(`${msg}：${url}`);

// 1. 涵蓋率：上游每個網址恰好出現一次
const readme = new Set(links.map((l) => l.url));
const seen = new Map();
for (const u of units) for (const [url] of u.lessons) seen.set(url, (seen.get(url) ?? 0) + 1);
for (const url of readme) if (!seen.has(url)) errors.push(`課程缺少：${url}`);
for (const [url, n] of seen) {
  if (!readme.has(url)) errors.push(`上游目錄沒有這個網址：${url}`);
  if (n > 1) errors.push(`重複收錄 ${n} 次：${url}`);
}
if (new Set(units.map((u) => u.id)).size !== units.length) errors.push('單元 id 重複');

// 2. 格式：標題、摘要不為空；重點數量依原文依據而定（全文 3～5 項、部分內容 1～5 項、只依標題 2～3 個問題）
const RANGE = { fulltext: [3, 5], partial: [1, 5], 'title-only': [2, 3] };
for (const url of Object.keys(bases)) if (!readme.has(url)) errors.push(`lesson-meta.json 有不在目錄裡的網址：${url}`);
for (const u of units) for (const [url, title, summary, points] of u.lessons) {
  const basis = bases[url]?.basis ?? 'fulltext';
  const [min, max] = RANGE[basis] ?? [0, -1];
  if (!title || !summary) errors.push(`標題或摘要空白：${url}`);
  if (points.length < min || points.length > max) errors.push(`${basis} 的重點應為 ${min}～${max} 項（目前 ${points.length}）：${url}`);
  if (basis === 'title-only' && points.some((p) => !/[？?]$/.test(p))) errors.push(`只依標題的課，重點要寫成待追查的問題：${url}`);
}

// 3. 寫法（只警告）：摘要長度、重點長度、空殼句、只有主題名詞、跨課重複
const HOLLOW_END = /(的經驗|的心得|的效益|的應用|的挑戰|的演進|的做法|的考量|的成果)$/;
const CLAIM = /(為什麼|如何|讓|把|可以|能|會|避免|減少|提升|降低|取代|因為|而不是|才|\?|？|\d)/;
const pointAt = new Map();
for (const u of units) for (const [url, , summary, points] of u.lessons) {
  if (summary.length < 40 || summary.length > 80) warn(url, `摘要長度 ${summary.length} 字`);
  for (const p of points) {
    if (p.length < 12 || p.length > 45) warn(url, `重點長度異常：${p}`);
    if (HOLLOW_END.test(p)) warn(url, `空殼句：${p}`);
    if (!CLAIM.test(p) && p.length < 15) warn(url, `只有主題名詞：${p}`);
    pointAt.set(p, [...(pointAt.get(p) ?? []), url]);
  }
}
for (const [p, urls] of pointAt) if (urls.length > 1) warnings.push(`跨課重複的重點「${p}」：${urls.join('、')}`);

// 4. 繁體中文：不在 Big5 常用與次常用字集內的漢字，多半是簡體字
const big5 = new Set();
const dec = new TextDecoder('big5');
for (let hi = 0xa4; hi <= 0xf9; hi++) for (const lo of [...Array(63).keys()].map((i) => 0x40 + i).concat([...Array(94).keys()].map((i) => 0xa1 + i))) {
  const ch = dec.decode(new Uint8Array([hi, lo]));
  if (ch.length === 1 && ch !== '�') big5.add(ch);
}
// Big5 罕用字區也收了一些簡體字（例如「与」「网」「据」），在台灣的技術文章裡幾乎不會用到，另外列出
const SIMPLIFIED_IN_BIG5 = new Set('与网据构优体价听坏惊扰极气确离胜触赶并么种儿厂宁岭庄异怀晒泞洁洼篱茧蚕圣党吨苹适复');
// 大陸慣用詞 → 台灣用語（「項目」「對象」「協議」在台灣另有正確用法，不列入）
const MAINLAND = [
  ['緩存', '快取'], ['服務器', '伺服器'], ['網絡', '網路'], ['內存', '記憶體'], ['線程', '執行緒'], ['進程', '行程'], ['集群', '叢集'],
  ['接口', '介面'], ['調用', '呼叫'], ['視頻', '影片'], ['軟件', '軟體'], ['硬件', '硬體'], ['質量', '品質'], ['默認', '預設'], ['運維', '維運'],
  ['(?<![壓充落確真])實時', '即時'], ['帶寬', '頻寬'], ['端口', '連接埠'], ['博客', '部落格'], ['模塊', '模組'], ['組件', '元件'], ['插件', '外掛'], ['(?<!損失|目標)函數(?!式)', '函式'],
  ['變量', '變數'], ['哈希', '雜湊'], ['隊列', '佇列'], ['字節', '位元組'], ['調試', '除錯'], ['集成', '整合'], ['操作系統', '作業系統'], ['存儲', '儲存'],
  ['智能', '智慧'], ['(?<!演)算法', '演算法'], ['網關', '閘道'], ['熔斷', '斷路器'], ['容災', '災難復原'], ['灰度', '漸進式'], ['事務', '交易'],
  ['分[佈布]式', '分散式'], ['並發(?![布表出])', '並行'], ['性能', '效能'], ['信息', '資訊'], ['數據', '資料'], ['用戶(?!端)', '使用者'], ['支持', '支援'],
  ['源碼', '原始碼'], ['代碼', '程式碼'], ['鏈路', '呼叫路徑'], ['打點', '事件追蹤'], ['優化', '最佳化'], ['登錄', '登入'], ['文檔', '文件'],
  ['[之以然最前]后|后[端來面續]', '後'], ['[這那哪]里', '裡'],
].map(([cn, tw]) => [new RegExp(cn), tw]);
const scan = (path) => {
  const text = readFileSync(new URL(path, root), 'utf8');
  text.split('\n').forEach((line, i) => {
    const bad = [...line].filter((c) => /[㐀-鿿]/.test(c) && (!big5.has(c) || SIMPLIFIED_IN_BIG5.has(c)));
    if (bad.length) errors.push(`${path}:${i + 1} 疑似簡體字「${[...new Set(bad)].join('')}」`);
    for (const [re, tw] of MAINLAND) if (re.test(line)) errors.push(`${path}:${i + 1} 大陸用語「${line.match(re)[0]}」，請改為「${tw}」`);
  });
};
const walk = (dir) => readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}${e.name}/`) : [`${dir}${e.name}`]));
for (const path of [...walk('src/').filter((p) => /\.(tsx?|css)$/.test(p)), 'scripts/fetch-articles.mjs', 'index.html', 'README.md', 'DESIGN.md', 'scripts/check-links.mjs', 'scripts/link-overrides.json']) scan(path);

const lessons = units.reduce((n, u) => n + u.lessons.length, 0);
if (warnings.length) console.warn(`${warnings.join('\n')}\n\n寫法警告 ${warnings.length} 個（不影響通過）\n`);
if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n共 ${errors.length} 個問題`);
  process.exit(1);
}
console.log(`通過：${units.length} 個單元、${lessons} 課，完整涵蓋上游 ${readme.size} 個網址，未發現簡體字或大陸用語。`);
