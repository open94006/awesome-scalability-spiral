// 學習進度與筆記的存放位置，打包時決定：
// - 本機版（npm run study／dev／preview）：存在本機伺服器的 SQLite（data/progress.sqlite）
// - GitHub Pages 版（npm run build:pages）：存在這個瀏覽器的 localStorage，換瀏覽器或清除網站資料就會不見
export const browserOnly = import.meta.env.MODE === 'pages';

export type HistoryRow = { lesson: string; time: Date; done: boolean; note: string | null };

export const where = browserOnly ? '這個瀏覽器' : '這台電腦的 data/progress.sqlite';
export const saveFailed = browserOnly ? '儲存失敗，瀏覽器可能不允許儲存或空間已滿' : '儲存失敗，請確認本機伺服器有開著';

// ---- 瀏覽器版 ----
const OLD_DONE = 'scale-spiral-done-v2'; // 早期版本只存完成的課代號
const DONE = 'scale-done-at-v1'; // { 課代號: 完成時間 }
const NOTES = 'scale-notes-v1'; // { 課代號: { text, at } }

type Notes = Record<string, { text: string; at: string }>;
const read = <T>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
};
// ponytail: 筆記全放在同一個 localStorage 鍵，瀏覽器上限約 5MB；筆記多到存不下時會顯示儲存失敗
const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

function localDone(): Record<string, string> {
  const done = read<Record<string, string>>(DONE, {});
  const old = read<string[]>(OLD_DONE, []);
  if (old.length) {
    for (const id of old) done[id] ??= new Date().toISOString();
    try { write(DONE, done); localStorage.removeItem(OLD_DONE); } catch { /* 下次再搬 */ }
  }
  return done;
}

// ---- 本機伺服器版 ----
const api = (path: string, init?: RequestInit) =>
  fetch(`/api/${path}`, init).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r; });
const post = (ids: string[], done: boolean): Promise<string[]> =>
  api('progress', { method: 'POST', body: JSON.stringify({ ids, done }) }).then((r) => r.json()).then((d) => d.done);

// ---- 對外介面 ----

// 瀏覽器版可以同步讀，第一次畫面就有進度；本機版要等伺服器回應
export const initialDone = (): string[] => (browserOnly ? Object.keys(localDone()) : []);

export async function loadDone(): Promise<string[]> {
  if (browserOnly) return Object.keys(localDone());
  const { done } = await api('progress').then((r) => r.json());
  // 改用 SQLite 之前存在瀏覽器的進度，補傳一次後就清掉
  const old = read<string[]>(OLD_DONE, []).filter((id) => !done.includes(id));
  const merged = old.length ? await post(old, true) : done;
  try { localStorage.removeItem(OLD_DONE); } catch { /* 沒關係，下次會再比對一次 */ }
  return merged;
}

export async function saveDone(ids: string[], value: boolean): Promise<void> {
  if (!browserOnly) { await post(ids, value); return; }
  const done = localDone();
  for (const id of ids) if (value) done[id] ??= new Date().toISOString(); else delete done[id];
  write(DONE, done);
}

export async function getNote(id: string): Promise<string> {
  if (browserOnly) return read<Notes>(NOTES, {})[id]?.text ?? '';
  return (await api(`notes/${id}`).then((r) => r.json())).text;
}

export async function putNote(id: string, text: string): Promise<void> {
  if (browserOnly) {
    const notes = read<Notes>(NOTES, {});
    if (text.trim()) notes[id] = { text, at: new Date().toISOString() }; else delete notes[id];
    write(NOTES, notes);
    return;
  }
  // keepalive 讓換頁時也送得出去，但瀏覽器限制 keepalive 請求最多 64KB
  await api(`notes/${id}`, { method: 'PUT', body: text, keepalive: text.length < 20_000 });
}

export async function loadHistory(): Promise<HistoryRow[]> {
  if (!browserOnly) {
    const rows: { lesson: string; at: string; done: number; note: string | null }[] = await api('history').then((r) => r.json());
    // SQLite 存的是 UTC 的「YYYY-MM-DD HH:MM:SS」
    return rows.map((r) => ({ lesson: r.lesson, time: new Date(`${r.at.replace(' ', 'T')}Z`), done: !!r.done, note: r.note }));
  }
  const done = localDone();
  const notes = read<Notes>(NOTES, {});
  return [...new Set([...Object.keys(done), ...Object.keys(notes)])]
    .map((lesson) => {
      const at = [done[lesson], notes[lesson]?.at].filter(Boolean).sort().at(-1)!;
      return { lesson, time: new Date(at), done: lesson in done, note: notes[lesson]?.text ?? null };
    })
    .sort((a, b) => b.time.getTime() - a.time.getTime());
}
