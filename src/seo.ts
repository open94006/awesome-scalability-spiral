// 網站名稱與各頁標題、描述。App 執行時的 document.title 與打包時產生的靜態頁（scripts/prerender.mjs）共用這裡，兩邊才不會不一致
import type { Tier, Unit } from './curriculum';

export const SITE_NAME = '系統設計學習網';
export const TAGLINE = '繁中重點，從分散式系統到面試';
export const HOME_TITLE = `${SITE_NAME}｜${TAGLINE}`;
export const HOME_DESCRIPTION = '916 篇系統設計經典文章的繁中重點，由淺入深學分散式系統、準備面試。';

const CN = ['', '一', '二', '三', '四'];
const TIER_TOPIC: Record<Tier['id'], string> = {
  knowledge: '基礎概念',
  habit: '服務穩定性',
  skill: '分散式系統元件',
  wisdom: '架構取捨與面試',
};
// 單元名稱不是大家會搜的詞時，標題改用這裡的說法
const UNIT_TITLE: Record<string, string> = { 'w-interview': '系統設計面試題型' };

export const withSite = (title: string) => `${title}｜${SITE_NAME}`;
export const tierTitle = (t: Tier) => `系統設計第${CN[t.no]}階：${TIER_TOPIC[t.id]}`;
export const unitTitle = (u: Unit) => UNIT_TITLE[u.id] ?? u.name;
export const unitDescription = (u: Unit) => `${u.question}${u.lessons.length} 篇繁中重點。`;
