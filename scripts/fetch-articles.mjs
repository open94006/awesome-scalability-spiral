// 原文擷取：依連結檢測結果抓回每一課的原文，存成 data/articles/<課程 id>.md，供改寫課程內容時對照。
// 擷取的原文只留在本機（data/ 已列入 .gitignore），不得提交、不得放上網站。
// 用法：node scripts/fetch-articles.mjs [--force] [課程 id ...]
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { extractText, getDocumentProxy } from 'unpdf';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const OUT = new URL('data/articles/', root);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const TIMEOUT = 40_000;
const MIN_WORDS = 300;

// 課程 id 與 src/curriculum/index.ts 相同：依課序算 FNV-1a 雜湊，碰撞時加尾碼
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}
export async function loadLessons() {
  const files = ['knowledge', 'habit', 'skill-data', 'skill-flow', 'skill-ops', 'skill-perf', 'skill-intel', 'wisdom'];
  const units = (await Promise.all(files.map((f) => import(new URL(`src/curriculum/${f}.ts`, root))))).flatMap((m) => Object.values(m)[0]);
  const { results, links } = JSON.parse(readFileSync(new URL('src/data/links.json', root), 'utf8'));
  const titles = new Map(links.map((l) => [l.url, l.title]));
  const used = new Set();
  return units.flatMap((u) => u.lessons.map(([url, title, summary, points]) => {
    let id = hash(url);
    while (used.has(id)) id += 'x';
    used.add(id);
    return { id, url, title, summary, points, unit: u.id, original: titles.get(url) ?? '', result: results[url] ?? { status: 'unknown' } };
  }));
}

// 來源：ok 用原網址、moved 用新網址、dead／soft-dead 用封存版（易主網域也只看封存版）
function sourceOf({ url, result }) {
  if (result.status === 'moved' && result.newUrl) return { src: result.newUrl, via: 'newUrl' };
  if (['dead', 'soft-dead'].includes(result.status) || result.hideOriginal) {
    // id_ 取得封存當時的原始頁面，不含 Wayback 工具列
    return result.archive ? { src: result.archive.replace(/\/web\/(\d+)\//, '/web/$1id_/'), via: 'archive' } : null;
  }
  return { src: url, via: 'url' };
}

const words = (t) => (t.match(/[A-Za-z0-9\u00c0-\u024f'’-]+|[\u3040-\u30ff\u3400-\u9fff]/g) ?? []).length;
const clean = (t) => t.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

// 每個網域同時最多 2 個連線（包含封存版與附件，不只課程本身的網址）
const slots = new Map();
async function slot(host, fn) {
  const s = slots.get(host) ?? slots.set(host, { n: 0, wait: [] }).get(host);
  while (s.n >= 2) await new Promise((r) => s.wait.push(r));
  s.n++;
  try { return await fn(); } finally { s.n--; s.wait.shift()?.(); }
}

async function get(url, tries = 0) {
  const res = await slot(new URL(url).host, () => fetchOnce(url));
  // archive.org 等網站限流時，等一下再試
  if (res.code === 429 && tries < 4) {
    await new Promise((r) => setTimeout(r, 15_000 * (tries + 1)));
    return get(url, tries + 1);
  }
  return res;
}

async function fetchOnce(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8', 'accept-language': 'en-US,en;q=0.9' } });
    const type = res.headers.get('content-type') ?? '';
    let buf = Buffer.from(await res.arrayBuffer());
    // Wayback 的 id_ 頁面會原樣回傳當年壓縮過的內容
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
    return { code: res.status, finalUrl: res.url, type, buf };
  } finally {
    clearTimeout(timer);
  }
}

const quiet = new VirtualConsole();
function readable(html, url) {
  const dom = new JSDOM(html, { url, virtualConsole: quiet });
  const doc = dom.window.document;
  const pageTitle = doc.title?.trim() ?? '';
  const meta = doc.querySelector('meta[name="description"],meta[property="og:description"]')?.getAttribute('content')?.trim() ?? '';
  const art = new Readability(doc).parse();
  dom.window.close();
  return { title: art?.title?.trim() || pageTitle, text: clean(art?.textContent ?? ''), meta };
}

async function pdfText(buf) {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  return clean(text.map((p, i) => `\n\n[第 ${i + 1} 頁]\n${p}`).join(''));
}

// YouTube：先找字幕，沒有就用影片說明（含章節），標為部分內容
async function youtube(url) {
  const id = new URL(url).searchParams.get('v') ?? new URL(url).pathname.split('/').pop();
  // 網頁版的字幕網址需要 PO token，Android 用戶端的不用
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)' },
    body: JSON.stringify({ context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 34, hl: 'en' } }, videoId: id }),
  });
  const player = await res.json();
  if (player.playabilityStatus?.status !== 'OK' && !player.videoDetails) throw new Error(`YouTube：${player.playabilityStatus?.reason ?? player.playabilityStatus?.status}`);
  const title = player.videoDetails?.title ?? '';
  const description = player.videoDetails?.shortDescription ?? '';
  let transcript = '';
  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const track = tracks.find((t) => t.languageCode?.startsWith('en') && t.kind !== 'asr') ?? tracks.find((t) => t.languageCode?.startsWith('en')) ?? tracks[0];
  if (track) {
    const r = await get(`${track.baseUrl.replace(/&fmt=\w+/, '')}&fmt=json3`).catch(() => null);
    try {
      const events = JSON.parse(r?.buf.toString('utf8') || '{}').events ?? [];
      transcript = clean(events.flatMap((e) => e.segs?.map((s) => s.utf8) ?? []).join('').replace(/\n/g, ' '));
    } catch { /* 字幕需要 PO token 時會回空內容 */ }
  }
  if (!transcript) transcript = await youtubeTranscriptByBrowser(id).catch(() => '');
  return transcript
    ? { type: 'youtube-transcript', title, text: `${description ? `【影片說明】\n${description}\n\n` : ''}【字幕】\n${transcript}` }
    : { type: 'youtube-description', title, text: description, partial: true };
}

let browser;
const browserSlots = { n: 0, max: 3, wait: [] };
async function withPage(fn) {
  while (browserSlots.n >= browserSlots.max) await new Promise((r) => browserSlots.wait.push(r));
  browserSlots.n++;
  browser ??= chromium.launch();
  const b = await browser;
  const ctx = await b.newContext({ userAgent: UA, locale: 'en-US' });
  try {
    const page = await ctx.newPage();
    return await fn(page);
  } finally {
    await ctx.close();
    browserSlots.n--;
    browserSlots.wait.shift()?.();
  }
}

async function youtubeTranscriptByBrowser(id) {
  return withPage(async (page) => {
    await page.goto(`https://www.youtube.com/watch?v=${id}&hl=en`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForTimeout(3000);
    await page.locator('tp-yt-paper-button#expand, #description-inline-expander #expand').first().click({ timeout: 5000 }).catch(() => {});
    await page.getByRole('button', { name: /show transcript/i }).first().click({ timeout: 8000 });
    await page.waitForSelector('ytd-transcript-segment-renderer', { timeout: 15000 });
    const segs = await page.$$eval('ytd-transcript-segment-renderer .segment-text', (els) => els.map((e) => e.textContent.trim()));
    return clean(segs.join(' '));
  });
}

// 對程式請求只回空殼頁（Medium 等）或需要執行 JavaScript 的網站，改用 Playwright 讀渲染後的頁面
async function rendered(url) {
  return withPage(async (page) => {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    return { code: res?.status() ?? 0, finalUrl: page.url(), html: await page.content() };
  });
}

// SlideShare：投影片逐字稿在頁面資料裡
function slideshare(html) {
  const data = html.match(/<script id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/s)?.[1];
  const slides = data ? JSON.parse(data)?.props?.pageProps?.slideshow?.transcript : null;
  return Array.isArray(slides) ? clean(slides.map((t, i) => `[投影片 ${i + 1}] ${t}`).join('\n')) : '';
}

export async function extract(src) {
  // 封存版依原網址判斷網站類型
  const host = new URL(src.match(/web\.archive\.org\/web\/\w+\/(https?:.+)$/)?.[1] ?? src).hostname;
  if (/(^|\.)youtube\.com$|^youtu\.be$/.test(host)) return youtube(src);
  const r = await get(src);
  if (r.code >= 400 && !/medium\.com|^medium\.|\.medium\.com/.test(host) && r.code !== 403) throw new Error(`HTTP ${r.code}`);
  if (r.type.includes('pdf') || r.buf.subarray(0, 5).toString() === '%PDF-') {
    return { type: 'pdf', title: '', text: await pdfText(r.buf) };
  }
  let html = r.buf.toString('utf8');
  let finalUrl = r.finalUrl;
  let art = readable(html, finalUrl);
  let type = 'html';
  if (/slideshare\.net/.test(host)) {
    const t = slideshare(html);
    if (t) return { type: 'slideshare', title: art.title, text: `${art.meta ? `【簡介】\n${art.meta}\n\n` : ''}【投影片逐字稿】\n${t}` };
  }
  if (r.code >= 400 || words(art.text) < MIN_WORDS) {
    const p = await rendered(src);
    const art2 = readable(p.html, p.finalUrl);
    if (words(art2.text) > words(art.text)) { art = art2; html = p.html; finalUrl = p.finalUrl; type = 'html-rendered'; }
    else if (r.code >= 400) throw new Error(`HTTP ${r.code}`);
  }
  let text = art.text;
  if (words(text) < MIN_WORDS && art.meta && !text.includes(art.meta)) text = `【頁面說明】\n${art.meta}\n\n${text}`;
  // USENIX 演講頁與 Google Research 論文頁只有摘要，附上投影片或論文 PDF
  if (/usenix\.org|research\.google|ai\.google/.test(host)) {
    const usenix = /usenix\.org/.test(host);
    const pdfs = [...new Set([...html.matchAll(/href="([^"]+\.pdf)"/g)].map((m) => new URL(m[1], finalUrl).href))].filter((u) => !usenix || /slides|paper|presentation/i.test(u)).slice(0, usenix ? 2 : 1);
    for (const u of pdfs) {
      const p = await get(u).catch(() => null);
      if (p?.code === 200 && p.buf.subarray(0, 5).toString() === '%PDF-') { text += `\n\n【附件 PDF：${u}】\n${await pdfText(p.buf)}`; type = 'html+pdf'; }
    }
  }
  return { type, title: art.title, text, finalUrl };
}

// ponytail: 直接請 Wayback 轉到最接近指定年份的快照，避開被限流的 availability API；
// 最新的快照常是轉址或 Cloudflare 驗證頁，所以再往前試幾年
const waybacks = (url) => ['2026', '2021', '2018'].map((y) => `https://web.archive.org/web/${y}id_/${url}`);

// 同一網域同時最多 2 個連線
async function runPool(items, keyOf, worker, total = 10, perHost = 2) {
  const busy = new Map();
  const queue = [...items];
  let active = 0, done = 0;
  return new Promise((resolve) => {
    const pump = () => {
      if (!queue.length && !active) return resolve();
      for (let i = 0; i < queue.length && active < total; i++) {
        const host = keyOf(queue[i]);
        if ((busy.get(host) ?? 0) >= perHost) continue;
        const [item] = queue.splice(i--, 1);
        busy.set(host, (busy.get(host) ?? 0) + 1);
        active++;
        worker(item).finally(() => {
          busy.set(host, busy.get(host) - 1);
          active--;
          if (++done % 25 === 0) console.error(`… ${done}/${items.length}`);
          setTimeout(pump, 200);
        });
      }
    };
    pump();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const only = new Set(args.filter((a) => !a.startsWith('--')));
  await mkdir(OUT, { recursive: true });
  const indexFile = new URL('_index.json', OUT);
  const index = existsSync(indexFile) ? JSON.parse(await readFile(indexFile, 'utf8')) : {};
  const lessons = (await loadLessons()).filter((l) => (only.size ? only.has(l.id) : force || !index[l.id] || index[l.id].basis === 'none'));
  console.error(`要擷取 ${lessons.length} 課`);

  await runPool(lessons, (l) => { const s = sourceOf(l); return s ? new URL(s.src).host : 'none'; }, async (l) => {
    const s = sourceOf(l);
    const entry = { url: l.url, original: l.original, status: l.result.status, source: s?.src ?? null, via: s?.via ?? null };
    if (!s) { index[l.id] = { ...entry, basis: 'none', error: '沒有可用的網址或封存版' }; return; }
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) { // 失敗重試 2 次
      try {
        let a = await extract(s.src).catch((e) => ({ error: e }));
        let src = s.src, via = s.via;
        // 原網址只拿到部分內容或打不開：改試封存版
        if ((a.error || a.partial || words(a.text) < MIN_WORDS) && via !== 'archive' && !a.type?.startsWith('youtube')) {
          for (const snap of waybacks(l.url)) {
            const b = await extract(snap).catch(() => null);
            if (b && words(b.text) > words(a.text ?? '')) { a = b; src = snap; via = 'archive-fallback'; }
            if (words(a.text ?? '') >= MIN_WORDS) break;
          }
        }
        if (a.error) throw a.error;
        const n = words(a.text);
        const basis = !a.partial && n >= MIN_WORDS ? 'fulltext' : n > 0 ? 'partial' : 'none';
        const head = ['---', `url: ${l.url}`, `source: ${src}`, `via: ${via}`, `type: ${a.type}`, `basis: ${basis}`, `words: ${n}`, `title: ${JSON.stringify(a.title ?? '')}`, `original: ${JSON.stringify(l.original)}`, '---', ''].join('\n');
        await writeFile(new URL(`${l.id}.md`, OUT), `${head}\n${a.text}\n`);
        index[l.id] = { ...entry, source: src, via, type: a.type, basis, words: n, title: a.title ?? '' };
        return;
      } catch (e) {
        lastError = e.message ?? String(e);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    index[l.id] = { ...entry, basis: 'none', error: lastError };
  });

  if (browser) await (await browser).close();
  await writeFile(indexFile, JSON.stringify(index, null, 1));
  const count = Object.values(index).reduce((acc, e) => ({ ...acc, [e.basis]: (acc[e.basis] ?? 0) + 1 }), {});
  console.error('結果：', count);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
