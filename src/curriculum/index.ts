import linkData from '../data/links.json';
import lessonMeta from '../data/lesson-meta.json';
import { knowledge } from './knowledge';
import { habit } from './habit';
import { skillData } from './skill-data';
import { skillFlow } from './skill-flow';
import { skillOps } from './skill-ops';
import { skillPerf } from './skill-perf';
import { skillIntel } from './skill-intel';
import { wisdom } from './wisdom';
import type { UnitSource } from './types';

export type TierId = 'knowledge' | 'habit' | 'skill' | 'wisdom';
export type LinkStatus = 'ok' | 'moved' | 'soft-dead' | 'dead' | 'unknown';
/** 摘要與重點的依據：讀過全文／只取得部分內容（例如演講摘要、影片說明）／取不到原文、只依標題 */
export type Basis = 'fulltext' | 'partial' | 'title-only';

export interface Lesson {
  id: string;
  title: string;
  original: string;
  summary: string;
  points: readonly string[];
  basis: Basis;
  url: string;
  /** 實際要開啟的網址：搬家的文章指向新網址；網域易主的不提供 */
  href: string | null;
  archive: string | null;
  status: LinkStatus;
  reason: string;
  host: string;
  section: string;
  unit: Unit;
  tier: Tier;
  /** 在整條路徑中的順序（0 起算） */
  order: number;
}

export interface Unit {
  id: string;
  name: string;
  question: string;
  group?: string;
  sections: string[];
  lessons: Lesson[];
  tier: Tier;
}

export interface Tier {
  id: TierId;
  no: number;
  name: string;
  verb: string;
  scale: string;
  promise: string;
  checkpoints: string[];
  units: Unit[];
}

const SECTION: Record<string, string> = {
  Principle: '設計原則',
  Scalability: '可擴展性',
  Availability: '可用性',
  Stability: '穩定性',
  Performance: '效能',
  Intelligence: '資料與機器學習',
  Architecture: '架構案例',
  Interview: '面試',
  Organization: '組織',
  Talk: '演講',
};

const TIERS: Omit<Tier, 'units'>[] = [
  {
    id: 'knowledge', no: 1, name: '知識', verb: '看懂', scale: '一個概念',
    promise: '能用自己的話說清楚：規模、延遲、一致性、資料分布與設計原則。',
    checkpoints: [
      '能解釋垂直擴展與水平擴展的差別，以及各自的隱藏成本',
      '能說出記憶體、磁碟與網路延遲大約相差幾個數量級',
      '能用 CAP 與最終一致性，說明網路分割時系統如何取捨',
      '能說明分片與一致性雜湊各自解決了什麼問題',
      '能舉例說明高內聚、低耦合與十二要素原則',
    ],
  },
  {
    id: 'habit', no: 2, name: '習慣', verb: '守住', scale: '一個服務',
    promise: '把量測、逾時、斷路、限流與容錯移轉，變成寫每個服務時的反射動作。',
    checkpoints: [
      '每次呼叫外部服務，都會先設定逾時與重試上限',
      '能說明斷路器的三種狀態，以及何時該用隔艙隔離資源',
      '能比較至少三種限流演算法的優缺點',
      '能說明負載平衡、容錯移轉與自動擴展如何一起守住可用性',
      '會用錯誤預算與故障演練檢驗自己的服務',
    ],
  },
  {
    id: 'skill', no: 3, name: '技能', verb: '組合', scale: '一組分散式元件',
    promise: '能針對問題挑選並組合快取、資料庫、佇列、搜尋、可觀測性與資料管線。',
    checkpoints: [
      '能為讀多寫少的服務設計快取層與失效策略',
      '能依存取模式選擇關聯式、鍵值、文件、欄式或時間序列資料庫',
      '能設計「至少一次傳遞」加上冪等處理的訊息流程',
      '能用日誌、指標與追蹤找出一個請求慢在哪裡',
      '能說明從批次、串流到機器學習平台的資料如何流動',
    ],
  },
  {
    id: 'wisdom', no: 4, name: '智慧', verb: '判斷', scale: '整個系統與團隊',
    promise: '能在整體架構與團隊層級做取捨，並清楚說明為什麼。',
    checkpoints: [
      '能讀懂一份真實的架構案例，指出它最關鍵的取捨',
      '能在四十五分鐘內，從需求講到容量估算、架構與取捨',
      '能判斷什麼時候不該導入新技術或拆分服務',
      '能說明團隊結構如何影響系統架構',
      '能用程式碼審查與事故檢討，讓整個團隊一起變強',
    ],
  },
];

const SOURCES: Record<TierId, UnitSource[]> = {
  knowledge,
  habit,
  skill: [...skillData, ...skillFlow, ...skillOps, ...skillPerf, ...skillIntel],
  wisdom,
};

type LinkResult = { status: LinkStatus; reason: string; archive?: string | null; newUrl?: string; hideOriginal?: boolean };
const results = linkData.results as unknown as Record<string, LinkResult>;
const readme = new Map(linkData.links.map((l) => [l.url, l]));
// ponytail: 只記錄不是全文的課，沒列出的就是讀過全文
const bases = lessonMeta as Record<string, { basis: Basis }>;

// ponytail: 32 位元 FNV-1a 雜湊當課程編號，網址不變編號就不變；916 筆碰撞機率約萬分之一，碰到時加尾碼
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

const usedIds = new Set<string>();
export const lessons: Lesson[] = [];

export const tiers: Tier[] = TIERS.map((meta) => {
  const tier: Tier = { ...meta, units: [] };
  tier.units = SOURCES[meta.id].map((source) => {
    const unit: Unit = { id: source.id, name: source.name, question: source.question, group: source.group, sections: [], lessons: [], tier };
    unit.lessons = source.lessons.map(([url, title, summary, points]) => {
      const result = results[url] ?? { status: 'unknown', reason: '尚未檢測' };
      const info = readme.get(url);
      let id = hash(url);
      while (usedIds.has(id)) id += 'x';
      usedIds.add(id);
      const lesson: Lesson = {
        id, title, summary, points, url, unit, tier,
        basis: bases[url]?.basis ?? 'fulltext',
        original: info?.title ?? '',
        href: result.hideOriginal ? null : result.newUrl ?? url,
        archive: result.archive ?? null,
        status: result.status,
        reason: result.reason,
        host: new URL(result.newUrl ?? url).hostname.replace(/^www\./, ''),
        section: SECTION[info?.section ?? ''] ?? '',
        order: lessons.length,
      };
      lessons.push(lesson);
      return lesson;
    });
    unit.sections = [...new Set(unit.lessons.map((l) => l.section))];
    return unit;
  });
  return tier;
});

export const units = tiers.flatMap((t) => t.units);
export const lessonById = new Map(lessons.map((l) => [l.id, l]));
export const unitById = new Map(units.map((u) => [u.id, u]));
export const tierById = new Map(tiers.map((t) => [t.id, t]));
export const checkedAt = linkData.checkedAt;
