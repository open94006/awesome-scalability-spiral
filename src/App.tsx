import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Archive, BookOpen, Check, ChevronLeft, ChevronRight, CircleAlert, Copy, ExternalLink, Menu, NotebookPen, Search, Sparkles, X } from 'lucide-react';
import { checkedAt, lessonById, lessons, tierById, tiers, unitById, type Lesson, type LinkStatus, type Tier, type Unit } from './curriculum';
import { DesignGuide, Logo } from './DesignGuide';

const STORE = 'scale-spiral-done-v2';
const CN = ['', '一', '二', '三', '四'];

type Route =
  | { name: 'home' }
  | { name: 'tier'; tier: Tier }
  | { name: 'unit'; unit: Unit }
  | { name: 'lesson'; lesson: Lesson }
  | { name: 'health' }
  | { name: 'history' }
  | { name: 'design' };

function parseRoute(hash: string): Route {
  const [, kind = '', id = ''] = hash.replace(/^#/, '').split('/');
  const tier = tierById.get(id as Tier['id']);
  const unit = unitById.get(id);
  const lesson = lessonById.get(id);
  if (kind === 'tier' && tier) return { name: 'tier', tier };
  if (kind === 'unit' && unit) return { name: 'unit', unit };
  if (kind === 'lesson' && lesson) return { name: 'lesson', lesson };
  if (kind === 'health') return { name: 'health' };
  if (kind === 'history') return { name: 'history' };
  if (kind === 'design') return { name: 'design' };
  return { name: 'home' };
}

const vars = (values: Record<string, string | number>) => values as CSSProperties;
const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);
const doneIn = (list: Lesson[], done: Set<string>) => list.reduce((n, l) => n + (done.has(l.id) ? 1 : 0), 0);
const tierLessons = (tier: Tier) => tier.units.flatMap((u) => u.lessons);
const nextLesson = (done: Set<string>, list = lessons) => list.find((l) => !done.has(l.id)) ?? list[0];
const searchText = new Map(lessons.map((l) => [l.id, `${l.title} ${l.original} ${l.summary} ${l.points.join(' ')} ${l.unit.name}`.toLowerCase()]));

function loadDone(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORE) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

const saveProgress = (ids: string[], done: boolean): Promise<{ done: string[] }> =>
  fetch('/api/progress', { method: 'POST', body: JSON.stringify({ ids, done }) }).then((r) => r.json());

export default function App() {
  const [hash, setHash] = useState(() => location.hash);
  const route = useMemo(() => parseRoute(hash), [hash]);
  const [done, setDone] = useState(loadDone);
  const [query, setQuery] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onHash = () => { setHash(location.hash); setQuery(''); setDrawer(false); window.scrollTo(0, 0); };
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') setDrawer(false);
    };
    addEventListener('hashchange', onHash);
    addEventListener('keydown', onKey);
    return () => { removeEventListener('hashchange', onHash); removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify([...done])); } catch { /* 無痕模式等情況存不了，改靠伺服器端 SQLite */ }
  }, [done]);

  // 以本機伺服器的 SQLite 為準；舊的 localStorage 進度第一次會補傳上去。沒有伺服器（純靜態部署）就只用 localStorage。
  useEffect(() => {
    const local = loadDone();
    fetch('/api/progress').then((r) => r.json()).then(async ({ done: saved }: { done: string[] }) => {
      const missing = [...local].filter((id) => !saved.includes(id));
      if (missing.length) saved = (await saveProgress(missing, true)).done;
      setDone(new Set(saved));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const title = route.name === 'lesson' ? route.lesson.title : route.name === 'unit' ? route.unit.name : route.name === 'tier' ? `第${CN[route.tier.no]}階 ${route.tier.name}` : route.name === 'health' ? '連結健康度' : route.name === 'history' ? '學習紀錄' : route.name === 'design' ? '設計規範' : '';
    document.title = title ? `${title}｜擴展螺旋` : '擴展螺旋｜大型系統的學習路徑';
  }, [route]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 1600);
    return () => clearTimeout(timer);
  }, [toast]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast('已複製');
    } catch {
      // 內嵌頁面或舊瀏覽器可能擋掉剪貼簿 API，改用隱藏文字框複製
      const area = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      setToast(ok ? '已複製' : '瀏覽器不允許複製，請改用滑鼠選取重點文字');
    }
  };

  const setLessonDone = (lesson: Lesson, value: boolean) => {
    saveProgress([lesson.id], value).catch(() => {});
    setDone((current) => {
      const next = new Set(current);
      if (value) next.add(lesson.id); else next.delete(lesson.id);
      return next;
    });
  };

  return (
    <div className="shell">
      <Sidebar route={route} done={done} open={drawer} onClose={() => setDrawer(false)} />
      <main className="main">
        <header className="topbar">
          <button className="btn btn-quiet btn-icon menu-button" onClick={() => setDrawer(true)} aria-label="開啟學習路徑"><Menu size={20} /></button>
          <Crumbs route={route} />
          <label className="search">
            <Search size={16} aria-hidden />
            <span className="sr-only">搜尋課題</span>
            <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }} placeholder="搜尋課題、概念或公司" />
            {query ? <button className="btn btn-quiet btn-icon" style={{ minHeight: 28, width: 28 }} onClick={() => setQuery('')} aria-label="清除搜尋"><X size={14} /></button> : <kbd>/</kbd>}
          </label>
        </header>
        {query.trim() ? (
          <SearchResults query={query.trim()} done={done} onPick={() => setQuery('')} />
        ) : route.name === 'tier' ? (
          <TierPage tier={route.tier} done={done} />
        ) : route.name === 'unit' ? (
          <UnitPage unit={route.unit} done={done} />
        ) : route.name === 'lesson' ? (
          <LessonPage lesson={route.lesson} done={done.has(route.lesson.id)} onDone={setLessonDone} onCopy={copy} />
        ) : route.name === 'health' ? (
          <HealthPage />
        ) : route.name === 'history' ? (
          <HistoryPage />
        ) : route.name === 'design' ? (
          <DesignGuide />
        ) : (
          <Home done={done} />
        )}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Sidebar({ route, done, open, onClose }: { route: Route; done: Set<string>; open: boolean; onClose: () => void }) {
  const activeUnit = route.name === 'unit' ? route.unit : route.name === 'lesson' ? route.lesson.unit : null;
  const activeTier = route.name === 'tier' ? route.tier : activeUnit?.tier ?? null;
  const next = nextLesson(done);
  const [openTier, setOpenTier] = useState<string>(activeTier?.id ?? next.tier.id);
  // 換到別的階段時自動展開它；在渲染中調整，避免先畫出舊的展開狀態
  const [shownTier, setShownTier] = useState(activeTier);
  if (activeTier !== shownTier) {
    setShownTier(activeTier);
    if (activeTier) setOpenTier(activeTier.id);
  }
  const finished = doneIn(lessons, done);
  const broken = lessons.filter((l) => l.status === 'dead' || l.status === 'soft-dead').length;

  return (
    <>
      {open && <div className="scrim" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <a className="brand" href="#/">
          <Logo />
          <span><span className="brand-name">擴展螺旋</span><span className="brand-sub">大型系統的學習路徑</span></span>
        </a>
        <div className={`progress-card tier-${next.tier.id}`}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="caption">已完成 <span className="num">{finished} / {lessons.length}</span> 課</span>
            <span className="caption num">{pct(finished, lessons.length)}%</span>
          </div>
          <div className="meter"><span style={{ width: `${pct(finished, lessons.length)}%` }} /></div>
          <a className="btn btn-primary" href={`#/lesson/${next.id}`}><BookOpen size={16} aria-hidden /><span>{finished ? '繼續' : '開始'}：{next.title}</span></a>
        </div>
        <nav className="path" aria-label="學習路徑">
          <p className="path-label">學習路徑</p>
          <ol className="rail">
            {tiers.map((tier) => {
              const all = tierLessons(tier);
              const isOpen = openTier === tier.id;
              return (
                <li key={tier.id} className={`rail-tier tier-${tier.id}`}>
                  <button className="rail-head" aria-expanded={isOpen} onClick={() => setOpenTier(isOpen ? '' : tier.id)}>
                    <span className="rail-node" style={vars({ '--p': pct(doneIn(all, done), all.length) })}><span>{tier.no}</span></span>
                    <span className="rail-title"><strong>{tier.name}</strong><small>{tier.verb}{tier.scale}</small></span>
                    <span className="rail-count">{doneIn(all, done)}/{all.length}</span>
                  </button>
                  {isOpen && (
                    <ol className="rail-units">
                      <li><a className={`rail-unit ${route.name === 'tier' && route.tier === tier ? 'is-current' : ''}`} href={`#/tier/${tier.id}`}><span>階段總覽與晉階檢核</span></a></li>
                      {tier.units.map((unit, i) => {
                        const k = doneIn(unit.lessons, done);
                        return (
                          <Fragment key={unit.id}>
                            {unit.group && unit.group !== tier.units[i - 1]?.group && <li className="rail-group">{unit.group}</li>}
                            <li>
                              <a className={`rail-unit ${unit === activeUnit ? 'is-current' : ''} ${k === unit.lessons.length ? 'is-done' : ''}`} href={`#/unit/${unit.id}`} aria-current={unit === activeUnit ? 'page' : undefined}>
                                <span>{unit.name}</span>
                                <span className="num">{k === unit.lessons.length ? <Check size={14} aria-label="已完成" /> : `${k}/${unit.lessons.length}`}</span>
                              </a>
                            </li>
                          </Fragment>
                        );
                      })}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="side-links">
          <a href="#/history" className={route.name === 'history' ? 'is-current' : ''}><span>學習紀錄</span><span className="caption">完成的課與筆記</span></a>
          <a href="#/health" className={route.name === 'health' ? 'is-current' : ''}><span>連結健康度</span><span className="caption">{broken} 條失效</span></a>
          <a href="#/design" className={route.name === 'design' ? 'is-current' : ''}><span>設計規範</span></a>
        </div>
        <p className="side-note caption">內容整理自 GitHub 上的 awesome-scalability 閱讀清單。學習進度與筆記存在這台電腦的 data/progress.sqlite，換瀏覽器也看得到。</p>
      </aside>
    </>
  );
}

function Crumbs({ route }: { route: Route }) {
  const unit = route.name === 'unit' ? route.unit : route.name === 'lesson' ? route.lesson.unit : null;
  const tier = route.name === 'tier' ? route.tier : unit?.tier;
  return (
    <nav className="crumbs" aria-label="目前位置">
      <a href="#/">路徑總覽</a>
      {tier && <><ChevronRight size={14} aria-hidden /><a href={`#/tier/${tier.id}`}>第{CN[tier.no]}階 {tier.name}</a></>}
      {unit && <><ChevronRight size={14} aria-hidden /><a href={`#/unit/${unit.id}`}>{unit.name}</a></>}
      {route.name === 'lesson' && <><ChevronRight size={14} aria-hidden /><strong>第 {route.lesson.unit.lessons.indexOf(route.lesson) + 1} 課</strong></>}
      {route.name === 'health' && <><ChevronRight size={14} aria-hidden /><strong>連結健康度</strong></>}
      {route.name === 'history' && <><ChevronRight size={14} aria-hidden /><strong>學習紀錄</strong></>}
      {route.name === 'design' && <><ChevronRight size={14} aria-hidden /><strong>設計規範</strong></>}
    </nav>
  );
}

function Home({ done }: { done: Set<string> }) {
  const next = nextLesson(done);
  const started = doneIn(lessons, done) > 0;
  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>從一個概念，<br />走到整個系統。</h1>
          <p className="lead">awesome-scalability 收錄的 {lessons.length} 篇文章，依照知識、習慣、技能、智慧四個階段，排成一條由淺入深的路。每一課只留下標題、摘要與重點，方便你複製去搜尋，或拿去問 AI。</p>
          <div className="row">
            <a className="btn btn-primary" href={`#/lesson/${next.id}`}>{started ? '繼續學習' : '從第一課開始'}</a>
            <a className="btn btn-secondary" href="#/tier/knowledge">看第一階有什麼</a>
          </div>
        </div>
        <ol className="stairs" aria-label="四個學習階段">
          {tiers.map((tier) => {
            const all = tierLessons(tier);
            const k = doneIn(all, done);
            return (
              <li key={tier.id} className={`tier-${tier.id}`}>
                <a className="step" href={`#/tier/${tier.id}`} style={vars({ '--p': pct(k, all.length) })}>
                  <span className="step-no">第{CN[tier.no]}階</span>
                  <span className="step-name">{tier.name}</span>
                  <span className="step-scale">{tier.verb}{tier.scale}</span>
                  <span className="step-count">{k}/{all.length} 課</span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <section className={`next-card tier-${next.tier.id}`}>
        <div className="stack" style={{ gap: 4 }}>
          <p className="eyebrow">{started ? '下一課' : '第一課'}：第{CN[next.tier.no]}階 {next.tier.name}，{next.unit.name}</p>
          <h2>{next.title}</h2>
          <p className="muted">{next.summary}</p>
        </div>
        <a className="btn btn-primary" href={`#/lesson/${next.id}`}>{started ? '繼續這一課' : '開始這一課'}</a>
      </section>

      <section className="section">
        <h2 className="section-title">四個階段，由小到大</h2>
        <p className="muted">每往上一階，你要照顧的範圍就更大：從一個概念，到一個服務、一組分散式元件，最後是整個系統與團隊。</p>
        <ul className="tier-list">
          {tiers.map((tier) => {
            const all = tierLessons(tier);
            return (
              <li key={tier.id} className={`tier-${tier.id}`}>
                <a className="tier-line" href={`#/tier/${tier.id}`}>
                  <span className="tier-badge">{tier.name}</span>
                  <span><strong>{tier.verb}{tier.scale}</strong><span className="caption" style={{ display: 'block' }}>{tier.promise}</span></span>
                  <span className="caption num">{tier.units.length} 個單元，{all.length} 課</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="section">
        <h2 className="section-title">每一課怎麼學</h2>
        <ol className="how">
          <li><strong>讀摘要與重點</strong><p className="muted">先用三分鐘知道這篇文章在解決什麼問題。</p></li>
          <li><strong>複製重點去深入</strong><p className="muted">貼到 Google 或 AI 對話，請它舉例說明，再出題考你。</p></li>
          <li><strong>標記完成，往下一課</strong><p className="muted">單元讀完會先看下一個單元的問題，再繼續往下走。</p></li>
        </ol>
      </section>
    </div>
  );
}

function TierPage({ tier, done }: { tier: Tier; done: Set<string> }) {
  const all = tierLessons(tier);
  const k = doneIn(all, done);
  const next = nextLesson(done, all);
  const prevTier = tiers[tier.no - 2];
  const nextTier = tiers[tier.no];
  return (
    <div className={`page tier-${tier.id}`}>
      <header className="page-head">
        <p className="eyebrow">第{CN[tier.no]}階，共 {tier.units.length} 個單元</p>
        <h1>{tier.name}：{tier.verb}{tier.scale}</h1>
        <p className="lead">{tier.promise}</p>
        <div className="meter" style={{ maxWidth: 420 }}><span style={{ width: `${pct(k, all.length)}%` }} /></div>
        <p className="caption">已完成 <span className="num">{k} / {all.length}</span> 課</p>
        <div className="row"><a className="btn btn-primary" href={`#/lesson/${next.id}`}>{k === 0 ? '開始這一階' : k === all.length ? '重溫這一階' : '繼續這一階'}</a></div>
      </header>

      <section className="section">
        <h2 className="section-title">晉階檢核</h2>
        <p className="muted">學完這一階，你應該能做到下面這些事。做不到的，回頭重讀對應的單元。</p>
        <ul className="checklist">
          {tier.checkpoints.map((c) => <li key={c}><Check size={14} aria-hidden /><span>{c}</span></li>)}
        </ul>
      </section>

      <section className="section">
        <h2 className="section-title">單元</h2>
        <div className="unit-grid">
          {tier.units.map((unit, i) => {
            const u = doneIn(unit.lessons, done);
            return (
              <Fragment key={unit.id}>
                {unit.group && unit.group !== tier.units[i - 1]?.group && <h3 className="group-title">{unit.group}</h3>}
                <a className="unit-card" href={`#/unit/${unit.id}`}>
                  <span className="unit-no">{i + 1}</span>
                  <div className="stack" style={{ gap: 2 }}><h3>{unit.name}</h3><p className="muted">{unit.question}</p></div>
                  <span className="unit-meta">
                    <span className="num">{u === unit.lessons.length ? '已完成' : `${u} / ${unit.lessons.length} 課`}</span>
                    <span className="meter"><span style={{ width: `${pct(u, unit.lessons.length)}%` }} /></span>
                    <span>{unit.sections.join('、')}</span>
                  </span>
                </a>
              </Fragment>
            );
          })}
        </div>
      </section>

      <nav className="pager" aria-label="其他階段">
        {prevTier ? <a className="btn btn-secondary" href={`#/tier/${prevTier.id}`}><ChevronLeft size={16} aria-hidden /><span>第{CN[prevTier.no]}階 {prevTier.name}</span></a> : <span />}
        {nextTier && <a className="btn btn-secondary" href={`#/tier/${nextTier.id}`}><span>第{CN[nextTier.no]}階 {nextTier.name}</span><ChevronRight size={16} aria-hidden /></a>}
      </nav>
    </div>
  );
}

function UnitPage({ unit, done }: { unit: Unit; done: Set<string> }) {
  const index = unit.tier.units.indexOf(unit);
  const k = doneIn(unit.lessons, done);
  const next = nextLesson(done, unit.lessons);
  const prevUnit = unit.tier.units[index - 1];
  const nextUnit = unit.tier.units[index + 1];
  return (
    <div className={`page tier-${unit.tier.id}`}>
      <header className="page-head">
        <p className="eyebrow">第{CN[unit.tier.no]}階 {unit.tier.name}，單元 {index + 1} / {unit.tier.units.length}</p>
        <h1>{unit.name}</h1>
        <p className="question">{unit.question}</p>
        <p className="caption">原目錄分類：{unit.sections.join('、')}。共 {unit.lessons.length} 課，已完成 {k} 課。</p>
        <div className="row">
          <a className="btn btn-primary" href={`#/lesson/${next.id}`}>{k === 0 ? '從第一課開始' : k === unit.lessons.length ? '重溫第一課' : `繼續第 ${unit.lessons.indexOf(next) + 1} 課`}</a>
        </div>
      </header>
      <ol className="lesson-list">
        {unit.lessons.map((lesson, i) => (
          <li key={lesson.id}>
            <LessonRow lesson={lesson} label={String(i + 1)} done={done.has(lesson.id)} />
          </li>
        ))}
      </ol>
      <nav className="pager" aria-label="其他單元">
        {prevUnit ? <a className="btn btn-secondary" href={`#/unit/${prevUnit.id}`}><ChevronLeft size={16} aria-hidden /><span>{prevUnit.name}</span></a> : <a className="btn btn-secondary" href={`#/tier/${unit.tier.id}`}><ChevronLeft size={16} aria-hidden /><span>回到階段總覽</span></a>}
        {nextUnit && <a className="btn btn-secondary" href={`#/unit/${nextUnit.id}`}><span>{nextUnit.name}</span><ChevronRight size={16} aria-hidden /></a>}
      </nav>
    </div>
  );
}

function LessonRow({ lesson, label, done, context, note }: { lesson: Lesson; label: string; done: boolean; context?: string; note?: string }) {
  return (
    <a className={`lesson-row tier-${lesson.tier.id} ${done ? 'is-done' : ''}`} href={`#/lesson/${lesson.id}`}>
      <span className="lesson-no">{label}</span>
      <span>
        <strong>{lesson.title}</strong>
        <span className="caption" lang="en">{lesson.original}</span>
        {context && <span className="caption">{context}</span>}
        {note && <span className="row-note"><NotebookPen size={14} aria-hidden />{note}</span>}
      </span>
      <span className="lesson-side">
        {(lesson.status === 'dead' || lesson.status === 'soft-dead') && <StatusChip status={lesson.status} />}
        {done && <Check size={16} className="done-mark" aria-label="已完成" />}
      </span>
    </a>
  );
}

const STATUS_LABEL: Record<LinkStatus, string> = { ok: '正常', moved: '已搬家', 'soft-dead': '文章已不在', dead: '連結失效', unknown: '無法確認' };

function StatusChip({ status }: { status: LinkStatus }) {
  return <span className={`chip chip-${status}`}>{STATUS_LABEL[status]}</span>;
}

function aiPrompt(lesson: Lesson) {
  return [
    `我正在學習大型系統設計，這一課的主題是「${lesson.title}」（原文標題：${lesson.original}）。`,
    '請用繁體中文與台灣常用的技術用語，並把我當作 Junior ~ Mid-Level 的工程師，逐一解釋下面幾個重點，並各舉一個實際例子：',
    ...lesson.points.map((p, i) => `${i + 1}. ${p}`),
    '最後請出三題練習題，讓我檢查自己是不是真的懂了。',
  ].join('\n');
}

function LessonPage({ lesson, done, onDone, onCopy }: { lesson: Lesson; done: boolean; onDone: (lesson: Lesson, value: boolean) => void; onCopy: (text: string) => void }) {
  const { unit, tier } = lesson;
  const index = unit.lessons.indexOf(lesson);
  const prev = lessons[lesson.order - 1];
  const next = lessons[lesson.order + 1];
  // 引導：同單元往下一課；換單元先看單元問題；換階段先看晉階檢核
  const nextHref = !next ? '#/' : next.tier !== tier ? `#/tier/${next.tier.id}` : next.unit !== unit ? `#/unit/${next.unit.id}` : `#/lesson/${next.id}`;
  const nextLabel = !next ? '回到路徑總覽' : next.tier !== tier ? `前往第${CN[next.tier.no]}階：${next.tier.name}` : next.unit !== unit ? `下一個單元：${next.unit.name}` : '下一課';
  const google = `https://www.google.com/search?q=${encodeURIComponent(`"${lesson.original}"`)}`;

  return (
    <article className={`page page-reading tier-${tier.id}`}>
      <header className="lesson-head">
        <p className="eyebrow">{unit.name}，第 {index + 1} / {unit.lessons.length} 課</p>
        <h1>{lesson.title}</h1>
        <p className="original"><span lang="en">{lesson.original}</span><br />{lesson.host}</p>
      </header>

      <div className="stack">
        <LinkNotice lesson={lesson} />
        <p className="lead">{lesson.summary}</p>
      </div>

      <section className="section">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="section-title">重點</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => onCopy(aiPrompt(lesson))}><Sparkles size={14} aria-hidden />複製 AI 提問</button>
        </div>
        <ul className="points">
          {lesson.points.map((point) => (
            <li key={point} className="point">
              <span>{point}</span>
              <button className="btn btn-quiet btn-icon" onClick={() => onCopy(point)} aria-label={`複製重點：${point}`} title="複製這個重點"><Copy size={16} aria-hidden /></button>
            </li>
          ))}
        </ul>
        <p className="caption">把重點貼到 Google 或 AI 對話中，請它舉例說明，再出題考你。</p>
      </section>

      <NoteBox key={lesson.id} lesson={lesson} />

      <section className="section">
        <h2 className="section-title">閱讀原文</h2>
        <div className="actions">
          {lesson.href && <a className="btn btn-secondary" href={lesson.href} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden />{lesson.status === 'moved' ? '開啟文章新網址' : '開啟原文'}</a>}
          {lesson.archive && <a className="btn btn-secondary" href={lesson.archive} target="_blank" rel="noreferrer"><Archive size={16} aria-hidden />網頁封存版</a>}
          <a className="btn btn-secondary" href={google} target="_blank" rel="noreferrer"><Search size={16} aria-hidden />用 Google 搜尋原文標題</a>
        </div>
      </section>

      <nav className="pager" aria-label="課題導覽">
        {prev ? <a className="btn btn-secondary" href={`#/lesson/${prev.id}`}><ChevronLeft size={16} aria-hidden /><span>上一課</span></a> : <span />}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {done ? (
            <>
              <button className="btn btn-secondary is-done" onClick={() => onDone(lesson, false)} aria-pressed="true"><Check size={16} aria-hidden />已完成</button>
              <a className="btn btn-primary" href={nextHref}><span>{nextLabel}</span><ChevronRight size={16} aria-hidden /></a>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => { onDone(lesson, true); location.hash = nextHref; }}><span>完成，{nextLabel}</span><ChevronRight size={16} aria-hidden /></button>
          )}
        </div>
      </nav>
    </article>
  );
}

type SaveState = '' | '儲存中…' | '已儲存' | '儲存失敗，請確認本機伺服器有開著';

// 每課一則筆記，停止打字 0.8 秒、離開輸入框或換頁時自動存進 SQLite
function NoteBox({ lesson }: { lesson: Lesson }) {
  const [text, setText] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>('');
  const saved = useRef('');
  const latest = useRef<string | null>(null);
  latest.current = text;

  const save = (value: string | null) => {
    if (value === null || value === saved.current) return;
    setState('儲存中…');
    fetch(`/api/notes/${lesson.id}`, { method: 'PUT', body: value, keepalive: true })
      .then((r) => { if (!r.ok) throw new Error(); saved.current = value; setState('已儲存'); })
      .catch(() => setState('儲存失敗，請確認本機伺服器有開著'));
  };

  useEffect(() => {
    fetch(`/api/notes/${lesson.id}`).then((r) => r.json()).then(({ text }: { text: string }) => { saved.current = text; setText(text); })
      .catch(() => { setText(''); setState('儲存失敗，請確認本機伺服器有開著'); });
    return () => save(latest.current);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => save(text), 800);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <section className="section">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section-title">我的筆記</h2>
        <span className="caption" role="status">{state}</span>
      </div>
      <textarea
        className="note"
        value={text ?? ''}
        disabled={text === null}
        placeholder={text === null ? '載入中…' : '把 AI 的回答、自己的理解、還沒想通的地方記在這裡。會自動儲存。'}
        onChange={(e) => { setText(e.target.value); setState(''); }}
        onBlur={() => save(text)}
        aria-label={`「${lesson.title}」的筆記`}
      />
    </section>
  );
}

type HistoryRow = { lesson: string; at: string; done: 0 | 1; note: string | null };

function HistoryPage() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [onlyNotes, setOnlyNotes] = useState(false);
  useEffect(() => {
    fetch('/api/history').then((r) => r.json()).then(setRows).catch(() => setRows([]));
  }, []);

  // 資料庫存的是 UTC，換成本地時間再依日期分組
  const entries = (rows ?? []).flatMap((r) => {
    const lesson = lessonById.get(r.lesson);
    return lesson ? [{ ...r, lesson, time: new Date(`${r.at.replace(' ', 'T')}Z`) }] : [];
  });
  const shown = onlyNotes ? entries.filter((e) => e.note) : entries;
  const dayOf = (d: Date) => d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  const days = new Map<string, typeof shown>();
  for (const e of shown) days.set(dayOf(e.time), [...(days.get(dayOf(e.time)) ?? []), e]);
  const doneCount = entries.filter((e) => e.done).length;
  const noteCount = entries.filter((e) => e.note).length;

  return (
    <div className="page">
      <header className="page-head">
        <h1>學習紀錄</h1>
        <p className="lead">你完成的課與寫下的筆記，依日期排列，最近的在最上面。</p>
      </header>

      <div className="stat-row" style={{ marginTop: 24 }}>
        <div className="stat"><span className="caption">完成</span><strong>{doneCount}</strong><span className="caption">課</span></div>
        <div className="stat"><span className="caption">筆記</span><strong>{noteCount}</strong><span className="caption">則</span></div>
        <div className="stat"><span className="caption">學習</span><strong>{new Set(entries.map((e) => dayOf(e.time))).size}</strong><span className="caption">天</span></div>
      </div>

      <section className="section">
        <div className="tabs" role="group" aria-label="篩選紀錄">
          <button className="btn btn-secondary btn-sm" aria-pressed={!onlyNotes} onClick={() => setOnlyNotes(false)}>全部　{entries.length}</button>
          <button className="btn btn-secondary btn-sm" aria-pressed={onlyNotes} onClick={() => setOnlyNotes(true)}>有筆記　{noteCount}</button>
        </div>
        {rows === null ? (
          <p className="muted">載入中…</p>
        ) : shown.length === 0 ? (
          <p className="muted">{onlyNotes ? '還沒有寫過筆記。在任何一課的「我的筆記」寫下想法，就會出現在這裡。' : '還沒有紀錄。完成一課或寫下筆記後，就會出現在這裡。'}</p>
        ) : (
          [...days].map(([day, list]) => (
            <div key={day}>
              <h3 className="group-title">{day}</h3>
              <ol className="lesson-list">
                {list.map((e) => (
                  <li key={e.lesson.id}>
                    <LessonRow
                      lesson={e.lesson}
                      label={e.time.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      done={!!e.done}
                      context={`第${CN[e.lesson.tier.no]}階 ${e.lesson.tier.name}，${e.lesson.unit.name}`}
                      note={e.note ?? undefined}
                    />
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function LinkNotice({ lesson }: { lesson: Lesson }) {
  if (lesson.status === 'ok') return null;
  const fallback = lesson.archive ? '可以改看網頁封存版，或用下方的重點搜尋其他資料。' : '目前找不到封存版，請用下方的重點搜尋其他資料。';
  const message: Record<Exclude<LinkStatus, 'ok'>, [string, string]> = {
    moved: ['原網址已失效，已改連到文章的新網址。', lesson.reason === '原網址已失效，文章搬到新網址' ? '' : lesson.reason],
    'soft-dead': [`頁面還打得開，但文章已經不在：${lesson.reason}。`, fallback],
    dead: [`連結已失效：${lesson.reason}。`, fallback],
    unknown: ['這個網站阻擋自動檢測，無法確認文章是否還在。', lesson.reason],
  };
  const [title, detail] = message[lesson.status];
  return (
    <div className={`callout callout-${lesson.status}`} role="note">
      <CircleAlert size={16} aria-hidden />
      <div><p><strong>{title}</strong></p>{detail && <p>{detail}</p>}</div>
    </div>
  );
}

function SearchResults({ query, done, onPick }: { query: string; done: Set<string>; onPick: () => void }) {
  const hits = useMemo(() => {
    const q = query.toLowerCase();
    return lessons.filter((l) => searchText.get(l.id)!.includes(q));
  }, [query]);
  return (
    <div className="page">
      <header className="page-head">
        <h1>搜尋「{query}」</h1>
        <p className="caption">找到 {hits.length} 課{hits.length > 60 ? '，先列出前 60 課' : ''}。按 Esc 清除搜尋。</p>
      </header>
      {hits.length === 0 ? (
        <p className="muted" style={{ marginTop: 24 }}>沒有符合的課題。試試換個說法，例如「快取」「Kafka」「Netflix」。</p>
      ) : (
        <ol className="lesson-list">
          {hits.slice(0, 60).map((lesson) => (
            <li key={lesson.id} onClick={onPick}>
              <LessonRow lesson={lesson} label={lesson.tier.name} done={done.has(lesson.id)} context={lesson.unit.name} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const REPORT_ORDER: LinkStatus[] = ['ok', 'moved', 'soft-dead', 'dead', 'unknown'];
const REPORT_TEXT: Record<LinkStatus, string> = {
  ok: '可以直接閱讀',
  moved: '已改連到新網址',
  'soft-dead': '頁面在，文章不在',
  dead: '打不開或已刪除',
  unknown: '網站阻擋檢測',
};
const REPORT_COLOR: Record<LinkStatus, string> = { ok: 'var(--ok)', moved: 'var(--t2)', 'soft-dead': '#d4a13a', dead: 'var(--danger)', unknown: 'var(--line-strong)' };

function HealthPage() {
  const [filter, setFilter] = useState<LinkStatus | 'all'>('all');
  const counts = Object.fromEntries(REPORT_ORDER.map((s) => [s, lessons.filter((l) => l.status === s).length])) as Record<LinkStatus, number>;
  const problems = lessons.filter((l) => l.status !== 'ok');
  const shown = filter === 'all' ? problems : problems.filter((l) => l.status === filter);
  const date = new Date(checkedAt).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="page">
      <header className="page-head">
        <h1>連結健康度</h1>
        <p className="lead">awesome-scalability 收錄的 {lessons.length} 個連結，每一個都檢查過：頁面能不能開、開了之後文章還在不在。</p>
        <p className="caption">檢測日期：{date}。先用程式逐一請求，再用真實瀏覽器複核 Medium 這類會擋程式的網站；搬家的文章會替你改連到新網址，失效的文章盡量附上網頁封存版。</p>
      </header>

      <div className="stack" style={{ marginTop: 24 }}>
        <div className="stat-row">
          {REPORT_ORDER.filter((s) => counts[s] > 0).map((s) => (
            <div key={s} className="stat">
              <StatusChip status={s} />
              <strong>{counts[s]}</strong>
              <span className="caption">{REPORT_TEXT[s]}</span>
            </div>
          ))}
        </div>
        <div className="stack-bar" role="img" aria-label={REPORT_ORDER.map((s) => `${STATUS_LABEL[s]} ${counts[s]}`).join('，')}>
          {REPORT_ORDER.map((s) => <span key={s} style={{ width: `${(counts[s] / lessons.length) * 100}%`, background: REPORT_COLOR[s] }} />)}
        </div>
      </div>

      <section className="section">
        <h2 className="section-title">需要留意的連結</h2>
        <div className="tabs" role="group" aria-label="篩選狀態">
          {(['all', 'moved', 'soft-dead', 'dead'] as const).map((f) => (
            <button key={f} className="btn btn-secondary btn-sm" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? '全部' : STATUS_LABEL[f]}　{f === 'all' ? problems.length : counts[f]}
            </button>
          ))}
        </div>
        <table className="report">
          <thead><tr><th>課題</th><th>狀態</th><th>原因</th><th>可以改看</th></tr></thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id}>
                <td><a href={`#/lesson/${l.id}`}>{l.title}</a><div className="mono" style={{ color: 'var(--ink-3)' }}>{l.url}</div></td>
                <td><StatusChip status={l.status} /></td>
                <td>{l.reason}</td>
                <td>
                  <div className="stack" style={{ gap: 4 }}>
                    {l.status === 'moved' && l.href && <a href={l.href} target="_blank" rel="noreferrer">新網址</a>}
                    {l.archive && <a href={l.archive} target="_blank" rel="noreferrer">網頁封存版</a>}
                    {l.status !== 'moved' && !l.archive && <span className="caption">用重點搜尋替代資料</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section">
        <h2 className="section-title">重新檢測</h2>
        <p className="muted">在專案目錄執行 <code className="mono">npm run check:links</code>，會重新抓取上游目錄並逐一檢測；以真實瀏覽器確認過的結果記錄在 <code className="mono">scripts/link-overrides.json</code>，下次檢測會沿用。</p>
      </section>
    </div>
  );
}
