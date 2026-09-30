/** [原文網址, 中文標題, 摘要, 重點（3～5 項）] */
export type LessonSource = readonly [url: string, title: string, summary: string, points: readonly string[]];

export interface UnitSource {
  id: string;
  name: string;
  /** 單元開頭拋出的問題：讀完這個單元要能回答它 */
  question: string;
  /** 側欄與階段頁的分組小標（選填） */
  group?: string;
  lessons: readonly LessonSource[];
}
