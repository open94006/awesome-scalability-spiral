import { Archive, Check, ChevronRight, CircleAlert, Copy, ExternalLink, Sparkles } from 'lucide-react';
import { SITE_NAME } from './seo';
import { lessons, tiers, units } from './curriculum';

export function Logo({ size = 36 }: { size?: number }) {
  // 四段弧線由小到大、由淺入深：知識 → 習慣 → 技能 → 智慧
  return (
    <svg width={size} height={size * 0.68} viewBox="9.5 12 24.5 16.5" fill="none" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M18.5 16A2.5 2.5 0 0 0 16 13.5" stroke="var(--t1)" />
      <path d="M16 13.5A5 5 0 0 0 11 18.5" stroke="var(--t2)" />
      <path d="M11 18.5A8.5 8.5 0 0 0 19.5 27" stroke="var(--t3)" />
      <path d="M19.5 27A13 13 0 0 0 32.5 14" stroke="var(--t4)" />
    </svg>
  );
}

// [變數, 淺色, 深色, 用途]
const BASE = [
  ['--bg', '#f1f4f3', '#0f171b', '頁面底色'],
  ['--surface', '#ffffff', '#162025', '卡片與閱讀區'],
  ['--surface-2', '#f6f8f7', '#1c2930', '懸停與次要區塊'],
  ['--ink', '#15293b', '#e8eff0', '內文與主要按鈕'],
  ['--ink-2', '#4b5b69', '#aab9be', '次要文字'],
  ['--ink-3', '#66737e', '#8b9ba2', '說明與數字'],
  ['--line', '#d8e0e0', '#263339', '分隔與框線'],
  ['--focus', '#22658f', '#6cb6e6', '鍵盤聚焦外框'],
];
const TIERS = [['#25776c', '#26796c'], ['#22658f', '#2b74a6'], ['#3a4692', '#5560bd'], ['#16223f', '#7561cc']];
const STATUS = [
  ['--ok', '#2b6e47', '#7fd0a0', '正常'],
  ['--moved', '#1a5075', '#86c1ea', '已搬家'],
  ['--warn', '#7f5300', '#e5b95c', '文章已不在'],
  ['--danger', '#a3302a', '#f19a92', '連結失效'],
];
const TYPE = [
  ['--fs-display', '48px', '首頁大標', 700, '從一個概念，走到整個系統。'],
  ['--fs-h1', '36px', '頁面標題', 700, '延遲、瓶頸與快取的直覺'],
  ['--fs-h2', '24px', '區段標題', 700, '晉階檢核'],
  ['--fs-h3', '21px', '卡片標題', 700, '規模會改變什麼'],
  ['--fs-lead', '18px', '摘要', 400, '比較「買更大的機器」與「加更多機器」兩條路的真實成本。'],
  ['--fs-body', '16px', '內文', 400, '把重點貼到 Google 或 AI 對話中，請它舉例說明，再出題考你。'],
  ['--fs-small', '14px', '按鈕與次要文字', 500, '已完成 12 / 47 課'],
  ['--fs-caption', '13px', '說明與原文標題', 400, 'Latency Numbers Every Programmer Should Know'],
];
const TERMS = [
  ['scalability', '可擴展性'], ['availability', '可用性'], ['stability', '穩定性'], ['performance', '效能'],
  ['resilience', '韌性'], ['latency', '延遲'], ['throughput', '吞吐量'], ['cache', '快取'],
  ['sharding', '分片'], ['replication', '複寫'], ['consistent hashing', '一致性雜湊'], ['eventual consistency', '最終一致性'],
  ['transaction', '交易'], ['isolation level', '隔離等級'], ['load balancing', '負載平衡'], ['rate limiting', '限流'],
  ['circuit breaker', '斷路器'], ['timeout', '逾時'], ['bulkhead', '隔艙'], ['failover', '容錯移轉'],
  ['autoscaling', '自動擴展'], ['microservices', '微服務'], ['service mesh', '服務網格'], ['message queue', '訊息佇列'],
  ['pub/sub', '發布／訂閱'], ['event sourcing', '事件溯源'], ['idempotency', '冪等性'], ['observability', '可觀測性'],
  ['distributed tracing', '分散式追蹤'], ['alerting', '告警'], ['garbage collection', '垃圾回收'], ['CDN', '內容傳遞網路'],
  ['big data', '巨量資料'], ['data pipeline', '資料管線'], ['stream processing', '串流處理'], ['SLO', '服務水準目標'],
  ['webhook', '事件回呼'], ['code review', '程式碼審查'], ['on-call', '值班'], ['postmortem', '事後檢討'],
];

export function DesignGuide() {
  const sample = lessons[1];
  const unit = units[1];
  const dead = lessons.find((l) => l.status === 'dead' && l.archive) ?? lessons[0];
  const soft = lessons.find((l) => l.status === 'soft-dead') ?? lessons[0];
  const moved = lessons.find((l) => l.status === 'moved') ?? lessons[0];

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">給設計與開發的共同語言</p>
        <h1>設計規範</h1>
        <p className="lead">這一頁用的就是網站實際的元件與樣式。要改字型、顏色或按鈕，改 <code className="mono">src/styles.css</code> 的設計變數，這裡會一起更新。文字規則寫在專案根目錄的 DESIGN.md。</p>
      </header>

      <section className="section">
        <h2 className="section-title">四個原則</h2>
        <ul className="how principles">
          <li><strong>由淺入深是字面意思</strong><p className="muted">四個階段的顏色從青綠一路加深到深海藍。和階段有關的元素，都用該階段的顏色。</p></li>
          <li><strong>大膽只留給一個地方</strong><p className="muted">首頁的階梯是唯一的主角。其他地方白底、細線、不加陰影。</p></li>
          <li><strong>文字是拿來讀的</strong><p className="muted">中文優先排版：內文 16px、行高 1.75，一行約 38 個字以內；全站只用一個中文字型與一個英文字型。</p></li>
          <li><strong>標示都要有資訊</strong><p className="muted">只有真正有順序的東西才編號；狀態標籤只在連結有問題時出現。</p></li>
          <li><strong>淺色與深色是同一套語意</strong><p className="muted">元件只讀設計變數，不寫死色碼；切換模式時，階段的順序、對比與狀態顏色的意思都不變。</p></li>
        </ul>
      </section>

      <section className="section">
        <h2 className="section-title">品牌標誌</h2>
        <div className="spec">
          <div className="row"><Logo size={72} /><div><p style={{ fontSize: 'var(--fs-h2)', fontWeight: 700 }}>{SITE_NAME}</p><p className="caption">四段弧線由小到大、由淺入深，對應知識、習慣、技能、智慧。</p></div></div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">色彩</h2>
        <p className="muted">每個色塊顯示目前模式下的實際顏色，下方的色碼依序是淺色與深色。右上角的按鈕可以切換整站的模式；預設跟著系統，切換後會記在這個瀏覽器。</p>
        <h3 className="group-title">基礎色</h3>
        <div className="swatches">{BASE.map(([name, light, dark, use]) => <Swatch key={name} name={name} light={light} dark={dark} use={use} />)}</div>
        <h3 className="group-title">階段色：由淺入深</h3>
        <div className="swatches">
          {tiers.map((t, i) => <Swatch key={t.id} name={`--t${i + 1}`} light={TIERS[i][0]} dark={TIERS[i][1]} use={`第${'一二三四'[i]}階 ${t.name}：${t.verb}${t.scale}`} />)}
        </div>
        <p className="caption">每個階段另有 <code className="mono">--tN-ink</code>（淺底上的文字）與 <code className="mono">--tN-tint</code>（淺色底）。白字放在階段色上，兩種模式的對比都在 4.5 以上。深色模式下階段色依「暗到亮」排列，色相仍是青綠、海藍、靛藍、紫藍，順序不變。</p>
        <h3 className="group-title">連結狀態</h3>
        <div className="swatches">{STATUS.map(([name, light, dark, use]) => <Swatch key={name} name={name} light={light} dark={dark} use={use} />)}</div>
        <h3 className="group-title">兩種模式並排</h3>
        <div className="themes">
          {(['light', 'dark'] as const).map((mode) => (
            <div key={mode} className="theme-preview" data-theme={mode}>
              <span className="caption">{mode === 'light' ? '淺色' : '深色'}</span>
              <div className="row">
                <button className="btn btn-primary">完成，下一課</button>
                <button className="btn btn-secondary">開啟原文</button>
                <button className="btn btn-quiet">取消</button>
              </div>
              <div className="row">
                {tiers.map((t) => <span key={t.id} className={`tier-${t.id}`}><span className="chip chip-tier">{t.name}</span></span>)}
              </div>
              <div className="row"><span className="chip chip-ok">正常</span><span className="chip chip-moved">已搬家</span><span className="chip chip-soft-dead">文章已不在</span><span className="chip chip-dead">連結失效</span></div>
              <div className="callout callout-dead"><CircleAlert size={16} aria-hidden /><div><p><strong>連結已失效。</strong></p><p>改看網頁封存版。</p></div></div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">字型與字級</h2>
        <div className="spec">
          <div className="type-row"><span className="caption">中文：思源黑體 TC</span><span style={{ fontSize: 'var(--fs-h2)', fontWeight: 700 }}>清楚好讀的黑體，標題到內文都用它</span></div>
          <div className="type-row"><span className="caption">英文與數字：IBM Plex Sans</span><span lang="en" style={{ fontSize: 'var(--fs-h2)', fontWeight: 700 }}>Latency 12 ms, p99 340 ms</span></div>
          <p className="caption">全站只有這兩個字型，沒有標題專用字型，也沒有等寬字。瀏覽器逐字挑選：英文字母與數字取自 IBM Plex Sans，中文與全形標點取自思源黑體 TC。層級靠字重與字級區分：標題 700、按鈕與強調 500、內文 400。網址與程式碼同樣用這兩個字型，並允許在任意位置換行。</p>
        </div>
        <div className="spec">
          {TYPE.map(([token, size, role, weight, text]) => (
            <div key={token} className="type-row">
              <span className="caption">{role}<br /><code className="mono">{token}</code> {size}</span>
              <span lang={token === '--fs-caption' ? 'en' : undefined} style={{ fontWeight: weight, fontSize: `var(${token})`, lineHeight: Number(weight) === 700 ? 1.35 : 1.75 }}>{text}</span>
            </div>
          ))}
        </div>
        <p className="caption">級數取自經典排印級數 13、14、16、18、21、24、36、48；中文在 12px 已難辨認，所以最小字級是 13px。手機上大標縮為 36px、頁面標題 28px。</p>
      </section>

      <section className="section">
        <h2 className="section-title">間距與圓角</h2>
        <div className="spec">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            {[4, 8, 12, 16, 24, 32, 48, 64].map((n) => <div key={n} style={{ textAlign: 'center' }}><div style={{ width: n, height: n, background: 'var(--t2-tint)', border: '1px solid var(--t2)', margin: '0 auto' }} /><span className="caption">{n}</span></div>)}
          </div>
          <div className="row">
            {[['--r-s', 6, '標籤、小元件'], ['--r-m', 10, '按鈕、輸入框、重點'], ['--r-l', 14, '卡片與區塊']].map(([t, r, use]) => (
              <div key={t} style={{ width: 150, height: 64, border: '1px solid var(--line-strong)', borderRadius: Number(r), display: 'grid', placeItems: 'center' }}><span className="caption">{t} {r}px<br />{use}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">按鈕</h2>
        <div className="spec">
          <div className="row">
            <button className="btn btn-primary">完成，下一課<ChevronRight size={16} aria-hidden /></button>
            <button className="btn btn-secondary"><ExternalLink size={16} aria-hidden />開啟原文</button>
            <button className="btn btn-quiet">回到階段總覽</button>
            <button className="btn btn-secondary btn-sm"><Sparkles size={14} aria-hidden />複製 AI 提問</button>
            <button className="btn btn-quiet btn-icon" aria-label="複製重點"><Copy size={16} aria-hidden /></button>
            <button className="btn btn-secondary is-done tier-knowledge"><Check size={16} aria-hidden />已完成</button>
            <button className="btn btn-primary" disabled>停用狀態</button>
          </div>
          <p className="caption">主要按鈕每個畫面最多一個，寫出按下後會發生的事。次要按鈕用在並列的選項；文字按鈕用在返回與取消；圖示按鈕一定要有 aria-label。高度 40px（小尺寸 32px）；觸控螢幕上放大到 44px（小尺寸 36px）。鍵盤聚焦時顯示 2px 外框。</p>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">卡片與列表</h2>
        <h3 className="group-title">單元卡</h3>
        <div className={`tier-${unit.tier.id}`}>
          <a className="unit-card" href={`${import.meta.env.BASE_URL}unit/${unit.id}/`}>
            <span className="unit-no">2</span>
            <div className="stack" style={{ gap: 2 }}><h3>{unit.name}</h3><p className="muted">{unit.question}</p></div>
            <span className="unit-meta"><span className="num">3 / {unit.lessons.length} 課</span><span className="meter"><span style={{ width: '33%' }} /></span><span>{unit.sections.join('、')}</span></span>
          </a>
        </div>
        <h3 className="group-title">課題列</h3>
        <ol className="lesson-list">
          <li><a className={`lesson-row tier-${sample.tier.id} is-done`} href={`${import.meta.env.BASE_URL}lesson/${sample.id}/`}><span className="lesson-no">1</span><span><strong>{sample.title}</strong><span className="caption" lang="en">{sample.original}</span></span><span className="lesson-side"><Check size={16} className="done-mark" aria-label="已完成" /></span></a></li>
          <li><a className={`lesson-row tier-${dead.tier.id}`} href={`${import.meta.env.BASE_URL}lesson/${dead.id}/`}><span className="lesson-no">2</span><span><strong>{dead.title}</strong><span className="caption" lang="en">{dead.original}</span></span><span className="lesson-side"><span className="chip chip-dead">連結失效</span></span></a></li>
        </ol>
        <h3 className="group-title">重點</h3>
        <ul className={`points tier-${sample.tier.id}`}>
          <li className="point"><span>{sample.points[0]}</span><button className="btn btn-quiet btn-icon" aria-label="複製重點"><Copy size={16} aria-hidden /></button></li>
        </ul>
        <h3 className="group-title">提示框</h3>
        <div className="stack" style={{ gap: 8 }}>
          <div className="callout callout-moved"><CircleAlert size={16} aria-hidden /><div><p><strong>原網址已失效，已改連到文章的新網址。</strong></p><p>例如：{moved.title}</p></div></div>
          <div className="callout callout-soft-dead"><CircleAlert size={16} aria-hidden /><div><p><strong>頁面還打得開，但文章已經不在：{soft.reason}。</strong></p><p>說明原因，並告訴讀者下一步可以怎麼做。</p></div></div>
          <div className="callout callout-dead"><CircleAlert size={16} aria-hidden /><div><p><strong>連結已失效：{dead.reason}。</strong></p><p><Archive size={12} aria-hidden /> 有網頁封存版時一併提供。</p></div></div>
        </div>
        <h3 className="group-title">狀態標籤</h3>
        <div className="row">
          <span className="chip chip-ok">正常</span><span className="chip chip-moved">已搬家</span><span className="chip chip-soft-dead">文章已不在</span><span className="chip chip-dead">連結失效</span><span className="chip chip-unknown">無法確認</span>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">文字規範</h2>
        <ul className="checklist tier-habit">
          <li><Check size={14} aria-hidden /><span>全站使用繁體中文與台灣慣用的技術詞彙，嚴禁簡體字。上線前執行 <code className="mono">npm run check:content</code>。</span></li>
          <li><Check size={14} aria-hidden /><span>英文技術名詞一律譯成中文，譯法依下方對照表。</span></li>
          <li><Check size={14} aria-hidden /><span>公司、產品與開源專案沒有通行譯名，保留原文，例如 Netflix、Kafka、Redis。</span></li>
          <li><Check size={14} aria-hidden /><span>業界通用的縮寫保留，例如 API、SQL、DNS、CPU；其他縮寫譯成中文，例如內容傳遞網路。</span></li>
          <li><Check size={14} aria-hidden /><span>文章的英文原標題保留在「原文標題」位置並標示為英文，方便搜尋原文。</span></li>
          <li><Check size={14} aria-hidden /><span>按鈕寫出按下後會發生的事；錯誤訊息說明發生什麼、下一步怎麼做，不道歉、不含糊。</span></li>
        </ul>
        <table className="term-table">
          <tbody>
            {Array.from({ length: TERMS.length / 2 }, (_, i) => (
              <tr key={i}>
                <td lang="en" className="muted">{TERMS[i * 2][0]}</td><td>{TERMS[i * 2][1]}</td>
                <td lang="en" className="muted">{TERMS[i * 2 + 1][0]}</td><td>{TERMS[i * 2 + 1][1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Swatch({ name, light, dark, use }: { name: string; light: string; dark: string; use: string }) {
  return (
    <div className="swatch">
      <i style={{ background: `var(${name})` }} />
      <div><code className="mono">{name}</code><br /><span className="mono num">{light}<br />{dark}<br /></span><span className="muted">{use}</span></div>
    </div>
  );
}
