import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import type { ServerResponse } from 'node:http';

// 學習進度與筆記存在本機 SQLite（data/progress.sqlite），換瀏覽器或開無痕都不會遺失。
// 學習者代號 = 電腦的 MAC 位址，同一台電腦的所有瀏覽器共用一份進度。網頁本身讀不到 MAC，所以由這個本機伺服器讀取；
// ponytail: 只在 npm run dev / npm run preview 時有效，部署成純靜態網站時前端會退回 localStorage。

// macOS 的 Wi‑Fi 預設用「私人位址」，換網路就會變；先讀硬體位址，讀不到才用目前網卡的位址
const hardwareMac = () => {
  try { return execFileSync('/usr/sbin/networksetup', ['-getmacaddress', 'en0'], { encoding: 'utf8' }).match(/(?:[0-9a-f]{2}:){5}[0-9a-f]{2}/)?.[0]; } catch { return undefined; }
};
const mac = hardwareMac() ?? Object.values(networkInterfaces()).flat()
  .find((n) => n && !n.internal && n.mac !== '00:00:00:00:00:00')?.mac ?? 'unknown-mac';

function progressApi(): Plugin {
  mkdirSync('data', { recursive: true });
  const db = new DatabaseSync('data/progress.sqlite');
  db.exec(`CREATE TABLE IF NOT EXISTS progress (
    learner TEXT NOT NULL, lesson TEXT NOT NULL, done_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (learner, lesson))`);
  db.exec(`CREATE TABLE IF NOT EXISTS notes (
    learner TEXT NOT NULL, lesson TEXT NOT NULL, text TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (learner, lesson))`);
  const list = db.prepare('SELECT lesson FROM progress WHERE learner = ? ORDER BY done_at');
  const add = db.prepare('INSERT OR IGNORE INTO progress (learner, lesson) VALUES (?, ?)');
  const remove = db.prepare('DELETE FROM progress WHERE learner = ? AND lesson = ?');
  const getNote = db.prepare('SELECT text FROM notes WHERE learner = ? AND lesson = ?');
  const putNote = db.prepare(`INSERT INTO notes (learner, lesson, text) VALUES (?, ?, ?)
    ON CONFLICT (learner, lesson) DO UPDATE SET text = excluded.text, updated_at = datetime('now')`);
  const deleteNote = db.prepare('DELETE FROM notes WHERE learner = ? AND lesson = ?');
  // 學習紀錄：每課一筆，時間取「完成」與「最後一次改筆記」較晚的那個
  const history = db.prepare(`SELECT lesson, max(at) AS at, max(done) AS done, max(note) AS note FROM (
      SELECT lesson, done_at AS at, 1 AS done, NULL AS note FROM progress WHERE learner = ?1
      UNION ALL SELECT lesson, updated_at, 0, text FROM notes WHERE learner = ?1)
    GROUP BY lesson ORDER BY at DESC`);

  const isId = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9]{1,32}$/.test(id);
  const json = (res: ServerResponse, data: unknown) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
  };

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const learner = mac;
    // 擋跨站請求：瀏覽器對跨站的 POST／PUT 一定會帶 Origin，別的網站就不能偷改你的進度或筆記
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) { res.statusCode = 403; return res.end(); }
    const [, route, id] = (req.url ?? '').split('?')[0].split('/');
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 200_000) { res.statusCode = 413; res.end(); req.destroy(); } // 一則筆記上限約 20 萬字
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      try {
        if (route === 'progress' && req.method === 'GET') return json(res, { done: list.all(learner).map((r) => r.lesson) });
        if (route === 'progress' && req.method === 'POST') {
          const { ids, done } = JSON.parse(body) as { ids: unknown; done: unknown };
          if (!Array.isArray(ids) || typeof done !== 'boolean' || !ids.every(isId)) throw new Error('格式錯誤');
          db.exec('BEGIN');
          for (const lesson of ids) (done ? add : remove).run(learner, lesson);
          db.exec('COMMIT');
          return json(res, { done: list.all(learner).map((r) => r.lesson) });
        }
        if (route === 'notes' && isId(id) && req.method === 'GET') return json(res, { text: getNote.get(learner, id)?.text ?? '' });
        if (route === 'notes' && isId(id) && req.method === 'PUT') {
          if (body.trim()) putNote.run(learner, id, body); else deleteNote.run(learner, id);
          res.statusCode = 204;
          return res.end();
        }
        if (route === 'history' && req.method === 'GET') return json(res, history.all(learner));
        next();
      } catch {
        if (db.isTransaction) db.exec('ROLLBACK');
        res.statusCode = 400;
        res.end();
      }
    });
  };

  return {
    name: 'progress-api',
    configureServer: (server) => {
      server.middlewares.use('/api', handler);
      // 開發伺服器會送出專案資料夾裡的任何檔案，資料庫與伺服器紀錄不能被下載
      server.middlewares.use('/data', (_req, res) => { res.statusCode = 404; res.end(); });
    },
    configurePreviewServer: (server) => { server.middlewares.use('/api', handler); },
  };
}

export default defineConfig({
  plugins: [react(), progressApi()],
});
