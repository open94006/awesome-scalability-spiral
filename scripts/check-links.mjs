// 連結檢測：解析 awesome-scalability README，逐一檢查連結是否失效。
// 用法：node scripts/check-links.mjs [README 路徑或網址]
// 輸出：src/data/links.json（原始目錄結構＋每個連結的檢測結果）
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const README_URL = 'https://raw.githubusercontent.com/binhnguyennus/awesome-scalability/master/README.md';
const OUT = new URL('../src/data/links.json', import.meta.url);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const TIMEOUT = 25_000;

// 「頁面能開，但文章已經不在」的常見訊號
const SOFT_DEAD = [
  /page (you('| a)re looking for )?(was )?not (be )?found/i, /\b404\b.{0,40}(not found|error|page)/i, /not found.{0,20}\b404\b/i,
  /(this|the) (page|post|article|story|content) (is |has been )?(no longer available|unavailable|removed|deleted|doesn'?t exist|does not exist|could not be found)/i,
  /(page|post) (doesn'?t|does not) exist/i, /nothing (was )?found/i, /oops!? .{0,40}(can'?t|cannot|couldn'?t) find/i,
  /domain (name )?(is|may be) for sale/i, /buy this domain/i, /this domain (has expired|is parked)/i, /parked (free|domain)/i,
  /account (has been )?suspended/i, /site (is )?(no longer|not) available/i, /this blog (has been|is) (deleted|archived|closed)/i,
];
const PARKING_HOSTS = /(sedoparking|parkingcrew|bodis|dan\.com|afternic|hugedomains|godaddy\.com\/domainsearch|domainmarket|parklogic|above\.com)/i;

export function parseReadme(md) {
  const links = [];
  let section = null;
  const parents = [];
  md.split(/\r?\n/).forEach((raw, i) => {
    const h = raw.match(/^##\s+(.+?)\s*$/);
    if (h) { section = h[1] === 'Content' || h[1] === 'A Piece of Cake' ? null : h[1]; parents.length = 0; return; }
    if (!section) return;
    // 網址本身可能含成對括號，例如 dn271399(v=pandp.10)
    const m = raw.match(/^(\s*)[*-]\s+\[(.+?)\]\((https?:\/\/(?:[^\s()]+|\([^\s)]*\))+)\)/);
    if (!m) return;
    const indent = m[1].replace(/\t/g, '    ').length;
    const depth = Math.round(indent / 4);
    parents.length = depth;
    links.push({ section, parent: depth ? parents[depth - 1] ?? null : null, depth, title: m[2].trim(), url: m[3], line: i + 1 });
    parents[depth] = m[3];
  });
  return links;
}

const pathOf = (u) => { try { return new URL(u).pathname.replace(/\/+$/, ''); } catch { return ''; } };
const titleOf = (html) => (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      redirect: 'follow', signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8', 'accept-language': 'en-US,en;q=0.9' },
    });
    const type = res.headers.get('content-type') ?? '';
    // ponytail: 只讀前 400KB，夠判斷標題與錯誤訊息
    const body = type.includes('html') || type.includes('text') ? (await res.text()).slice(0, 400_000) : (res.body?.cancel(), '');
    return { code: res.status, finalUrl: res.url, type, title: titleOf(body), text: textOf(body).slice(0, 6000) };
  } catch (e) {
    return { code: 0, error: e.cause?.code ?? e.name ?? String(e) };
  } finally {
    clearTimeout(timer);
  }
}

// 狀態：ok 正常／moved 已搬家（有 newUrl）／soft-dead 頁面還在但文章不在／dead 失效／unknown 無法自動確認
const NET_ERRORS = { ENOTFOUND: '網域已不存在', ECONNREFUSED: '伺服器拒絕連線', ECONNRESET: '連線被中斷', UND_ERR_CONNECT_TIMEOUT: '連線逾時', AbortError: '連線逾時', UNABLE_TO_VERIFY_LEAF_SIGNATURE: '網站憑證無效', CERT_HAS_EXPIRED: '網站憑證已過期' };

export function classify(url, r, fingerprint) {
  if (r.code === 0) return { status: 'dead', reason: NET_ERRORS[r.error] ?? '無法連線' };
  if ([401, 403, 429, 999].includes(r.code) || /just a moment|attention required|access denied/i.test(r.title)) return { status: 'unknown', reason: `網站拒絕自動檢測（HTTP ${r.code}）` };
  if (r.code === 404 || r.code === 410) return { status: 'dead', reason: `頁面不存在（HTTP ${r.code}）` };
  if (r.code >= 400) return { status: 'dead', reason: `伺服器錯誤（HTTP ${r.code}）` };
  if (PARKING_HOSTS.test(r.finalUrl)) return { status: 'soft-dead', reason: '網域已被轉賣或停放' };
  const hay = `${r.title} ${r.text.slice(0, 3000)}`;
  const hit = SOFT_DEAD.find((re) => re.test(hay));
  if (hit) return { status: 'soft-dead', reason: `頁面顯示找不到內容（「${hay.match(hit)[0].slice(0, 60)}」）` };
  const from = pathOf(url), to = pathOf(r.finalUrl);
  if (from.length > 1 && to.length <= 1) return { status: 'soft-dead', reason: '被導回網站首頁，原文已不存在' };
  if (fingerprint && fingerprint.code < 300 && r.finalUrl !== url && r.finalUrl === fingerprint.finalUrl) return { status: 'soft-dead', reason: '被導向與不存在頁面相同的位置' };
  if (fingerprint && fingerprint.code < 300 && r.title && r.title === fingerprint.title && from.length > 1) return { status: 'unknown', reason: '內容與不存在頁面相同，需人工確認' };
  if (/\.pdf$/i.test(from) && !r.type.includes('pdf')) return { status: 'unknown', reason: 'PDF 連結回傳的不是 PDF' };
  return { status: 'ok', reason: r.finalUrl !== url && new URL(r.finalUrl).host !== new URL(url).host ? `已轉址至 ${new URL(r.finalUrl).host}` : '' };
}

async function wayback(url) {
  const r = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`).then((x) => x.json()).catch(() => null);
  const snap = r?.archived_snapshots?.closest;
  return snap?.available ? snap.url.replace(/^http:/, 'https:') : null;
}

// 同一網站同時最多 2 個請求，避免被限流
async function runPool(urls, worker, total = 12, perHost = 2) {
  const busy = new Map();
  const queue = [...urls];
  let active = 0, done = 0;
  return new Promise((resolve) => {
    const pump = () => {
      if (!queue.length && !active) return resolve();
      for (let i = 0; i < queue.length && active < total; i++) {
        const host = new URL(queue[i]).host;
        if ((busy.get(host) ?? 0) >= perHost) continue;
        const [url] = queue.splice(i--, 1);
        busy.set(host, (busy.get(host) ?? 0) + 1);
        active++;
        worker(url).finally(() => {
          busy.set(host, busy.get(host) - 1);
          active--;
          if (++done % 50 === 0) console.error(`… ${done}/${urls.length}`);
          setTimeout(pump, 150);
        });
      }
    };
    pump();
  });
}

async function main() {
  const src = process.argv[2] ?? README_URL;
  const md = /^https?:/.test(src) ? await (await fetch(src)).text() : await readFile(src, 'utf8');
  const links = parseReadme(md);
  const urls = [...new Set(links.map((l) => l.url))];
  console.error(`解析到 ${links.length} 個連結（不重複 ${urls.length} 個）`);

  const prints = new Map();
  for (const origin of new Set(urls.map((u) => new URL(u).origin))) prints.set(origin, null);
  await runPool([...prints.keys()].map((o) => `${o}/zz-not-a-real-page-${Date.now().toString(36)}`), async (u) => {
    prints.set(new URL(u).origin, await get(u));
  });

  const results = {};
  await runPool(urls, async (url) => {
    let r = await get(url);
    if (r.code === 0 || r.code >= 500) r = await get(url); // 暫時性錯誤重試一次
    const verdict = classify(url, r, prints.get(new URL(url).origin));
    results[url] = { ...verdict, code: r.code, finalUrl: r.finalUrl ?? null };
  });

  // 瀏覽器人工複核的結果優先（Medium 等網站對程式請求只回空殼頁，無法自動判斷）
  const overrides = JSON.parse(await readFile(new URL('./link-overrides.json', import.meta.url), 'utf8'));
  for (const [url, fix] of Object.entries(overrides.links)) {
    if (!results[url]) continue;
    // 複核時正常、這次卻明確 404／410／網域消失：以這次為準（文章在複核後才下架）
    if (fix.status === 'ok' && results[url].status === 'dead' && /404|410|ENOTFOUND/.test(results[url].reason)) continue;
    results[url] = { ...results[url], reason: '', ...fix, verifiedAt: overrides.verifiedAt };
    if (fix.status === 'moved' && !fix.reason) results[url].reason = '原網址已失效，文章搬到新網址';
  }

  const broken = urls.filter((u) => ['dead', 'soft-dead'].includes(results[u].status));
  await runPool(broken, async (url) => { results[url].archive = await wayback(url); }, 4, 4);

  const count = Object.values(results).reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  console.error('結果：', count);
  await mkdir(new URL('.', OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ checkedAt: new Date().toISOString(), source: README_URL, links, results }, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
