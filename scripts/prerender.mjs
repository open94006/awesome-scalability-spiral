// 打包後替每個階段、單元、課題產生一份靜態 HTML，再產生 sitemap.xml、llms.txt、llms-full.txt。
// 搜尋引擎與 AI 爬蟲多半不執行 JavaScript，靠這些檔案才讀得到內容；React 載入後會直接換成互動版畫面。
// 用法：vite build --mode pages 之後執行 node scripts/prerender.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';

const SITE = 'https://open94006.github.io/awesome-scalability-spiral/';
const DIST = 'dist';

// 不讀 vite.config.ts：那裡的進度介面會開資料庫，打包用不到
const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { tiers, lessons } = await vite.ssrLoadModule('/src/curriculum/index.ts');
const { SITE_NAME: NAME, HOME_TITLE, HOME_DESCRIPTION, withSite, tierTitle, unitTitle, unitDescription } = await vite.ssrLoadModule('/src/seo.ts');
await vite.close();

// 內容最後一次更新的日期（工作流程要 fetch-depth: 0 才有完整歷史）
const updated = execFileSync('git', ['log', '-1', '--format=%cs', '--', 'src/curriculum', 'src/data'], { encoding: 'utf8' }).trim()
  || new Date().toISOString().slice(0, 10);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ld = (data) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c')}</script>`;
const url = { tier: (t) => `${SITE}tier/${t.id}/`, unit: (u) => `${SITE}unit/${u.id}/`, lesson: (l) => `${SITE}lesson/${l.id}/` };
const tierName = tierTitle;
const crumbs = (items) => ld({
  '@type': 'BreadcrumbList',
  itemListElement: [[NAME, SITE], ...items].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
});
const crumbNav = (items) => `<nav aria-label="目前位置"><a href="${SITE}">路徑總覽</a>${items.map(([n, u]) => ` › <a href="${u}">${esc(n)}</a>`).join('')}</nav>`;
const author = { '@type': 'Person', name: 'open94006', url: 'https://github.com/open94006' };
const upstream = { '@type': 'CreativeWork', name: 'awesome-scalability', url: 'https://github.com/binhnguyennus/awesome-scalability' };

const template = readFileSync(`${DIST}/index.html`, 'utf8');
const page = ({ path, title, description, type = 'article', head = '', body }) => {
  const canonical = SITE + path;
  const html = template
    .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${esc(description)}"`)
    .replace('</head>', [
      `<link rel="canonical" href="${canonical}" />`,
      `<meta property="og:type" content="${type}" />`,
      `<meta property="og:url" content="${canonical}" />`,
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:description" content="${esc(description)}" />`,
      head, '</head>'].join('\n    '))
    .replace('<div id="root"></div>', `<div id="root"><main class="prerender">${body}<p><small>最後更新：<time datetime="${updated}">${updated}</time></small></p></main></div>`);
  mkdirSync(`${DIST}/${path}`, { recursive: true });
  writeFileSync(`${DIST}/${path}index.html`, html);
};
const short = (s, n = 150) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// 首頁
const about = `${NAME}是繁體中文的系統設計學習網站：把 GitHub 上的 awesome-scalability 閱讀清單（${lessons.length} 篇系統設計與分散式系統文章）整理成由淺入深的學習路徑，分成知識、習慣、技能、智慧四個階段，最後一階涵蓋系統設計面試題型。每一課有中文標題、摘要與三到五個重點，並附上原文連結。`;
page({
  path: '', type: 'website',
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  head: [
    '<link rel="alternate" type="text/plain" href="llms.txt" title="llms.txt" />',
    ld({ '@type': 'WebSite', name: NAME, url: SITE, inLanguage: 'zh-Hant-TW' }),
    ld({
      '@type': 'Course', name: NAME, description: about, url: SITE, inLanguage: 'zh-Hant-TW',
      isAccessibleForFree: true, provider: author, isBasedOn: upstream, dateModified: updated,
      hasPart: tiers.map((t) => ({ '@type': 'Course', name: tierName(t), description: t.promise, url: url.tier(t) })),
    }),
  ].join('\n    '),
  body: `<h1>${HOME_TITLE}</h1><p>${esc(about)}</p>`
    + tiers.map((t) => `<section><h2><a href="${url.tier(t)}">${esc(tierName(t))}</a></h2><p>${esc(t.promise)}</p><ul>${
      t.units.map((u) => `<li><a href="${url.unit(u)}">${esc(u.name)}</a>：${esc(u.question)}</li>`).join('')}</ul></section>`).join(''),
});

for (const t of tiers) {
  page({
    path: `tier/${t.id}/`,
    title: withSite(tierName(t)),
    description: t.promise,
    head: crumbs([[tierName(t), url.tier(t)]]),
    body: `${crumbNav([[tierName(t), url.tier(t)]])}<h1>${esc(t.name)}：${esc(t.verb + t.scale)}</h1><p>${esc(t.promise)}</p>`
      + `<h2>晉階檢核</h2><ul>${t.checkpoints.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`
      + `<h2>單元</h2><ul>${t.units.map((u) => `<li><a href="${url.unit(u)}">${esc(u.name)}</a>：${esc(u.question)}（${u.lessons.length} 課）</li>`).join('')}</ul>`,
  });
  for (const u of t.units) {
    const trail = [[tierName(t), url.tier(t)], [unitTitle(u), url.unit(u)]];
    page({
      path: `unit/${u.id}/`,
      title: withSite(unitTitle(u)),
      description: unitDescription(u),
      head: crumbs(trail),
      body: `${crumbNav(trail.slice(0, 1))}<h1>${esc(u.name)}</h1><p>${esc(u.question)}</p>`
        + `<ol>${u.lessons.map((l) => `<li><a href="${url.lesson(l)}">${esc(l.title)}</a>：${esc(l.summary)}</li>`).join('')}</ol>`,
    });
  }
}

for (const l of lessons) {
  const trail = [[tierName(l.tier), url.tier(l.tier)], [l.unit.name, url.unit(l.unit)], [l.title, url.lesson(l)]];
  const prev = lessons[l.order - 1], next = lessons[l.order + 1];
  page({
    path: `lesson/${l.id}/`,
    title: withSite(l.title),
    description: short(l.summary),
    head: [crumbs(trail), ld({
      '@type': 'LearningResource', name: l.title, alternateName: l.original || undefined, description: l.summary,
      url: url.lesson(l), inLanguage: 'zh-Hant-TW', learningResourceType: '文章導讀', isAccessibleForFree: true,
      author, dateModified: updated, keywords: [l.unit.name, l.section].filter(Boolean).join(', '),
      isPartOf: { '@type': 'Course', name: l.unit.name, url: url.unit(l.unit) },
      isBasedOn: { '@type': 'CreativeWork', name: l.original || l.title, url: l.href ?? l.url },
    })].join('\n    '),
    body: `${crumbNav(trail.slice(0, 2))}<article><h1>${esc(l.title)}</h1>`
      + (l.original ? `<p lang="en">${esc(l.original)}（${esc(l.host)}）</p>` : '')
      + `<p>${esc(l.summary)}</p>`
      + `<h2>${l.basis === 'title-only' ? '待追查的問題' : '重點'}</h2><ul>${l.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
      + (l.basis === 'title-only' ? '<p>本課取不到原文，以上依標題整理，僅供追查方向。</p>' : '')
      + `<h2>閱讀原文</h2><p>${l.href ? `<a href="${esc(l.href)}" rel="noreferrer">${esc(l.original || l.href)}</a>` : '原網址已失效'}${l.archive ? `｜<a href="${esc(l.archive)}" rel="noreferrer">網頁封存版</a>` : ''}</p></article>`
      + `<nav aria-label="課題導覽">${prev ? `<a href="${url.lesson(prev)}">上一課：${esc(prev.title)}</a>` : ''}${prev && next ? '｜' : ''}${next ? `<a href="${url.lesson(next)}">下一課：${esc(next.title)}</a>` : ''}</nav>`,
  });
}

// GitHub Pages 找不到檔案時送 404.html：學習紀錄、連結健康度等不需收錄的頁面也靠它載入
writeFileSync(`${DIST}/404.html`, template.replace('</head>', '<meta name="robots" content="noindex" />\n  </head>'));

// sitemap：專案網站放不了網域根目錄的 robots.txt，要到 Google Search Console 手動提交這個檔案
const urls = [SITE, ...tiers.map(url.tier), ...tiers.flatMap((t) => t.units.map(url.unit)), ...lessons.map(url.lesson)];
writeFileSync(`${DIST}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
  urls.map((u) => `  <url><loc>${u}</loc><lastmod>${updated}</lastmod></url>`).join('\n')}\n</urlset>\n`);

// llms.txt（https://llmstxt.org）：給 AI 的網站大綱；llms-full.txt 是全部課題的摘要與重點
const intro = `# ${NAME}\n\n> ${about}\n\n內容最後更新：${updated}。每一課的摘要與重點由本站整理，原文著作權屬於各原作者，引用時請附上原文連結。\n`;
writeFileSync(`${DIST}/llms.txt`, `${intro}\n- [全部課題的摘要與重點](${SITE}llms-full.txt)\n${tiers.map((t) =>
  `\n## ${tierName(t)}\n\n${t.promise}\n\n${t.units.map((u) => `- [${u.name}](${url.unit(u)}): ${u.question}`).join('\n')}\n`).join('')}`);
writeFileSync(`${DIST}/llms-full.txt`, `${intro}${tiers.map((t) => `\n## ${tierName(t)}\n${t.units.map((u) =>
  `\n### ${u.name}\n\n${u.question}\n${u.lessons.map((l) => `\n#### ${l.title}\n\n網址：${url.lesson(l)}\n原文：${l.original ? `${l.original} ` : ''}${l.href ?? l.url}${
    l.basis === 'title-only' ? '\n（取不到原文，以下依標題整理）' : ''}\n\n${l.summary}\n\n${l.points.map((p) => `- ${p}`).join('\n')}\n`).join('')}`).join('')}`).join('')}`);

console.log(`已產生 ${urls.length} 個靜態頁、sitemap.xml、llms.txt、llms-full.txt（內容更新日 ${updated}）`);
