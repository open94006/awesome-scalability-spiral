#!/bin/sh
# 開啟學習網站：伺服器沒開就在背景啟動（關掉終端機視窗也會繼續跑），再用預設瀏覽器打開。
cd "$(dirname "$0")/.." || exit 1
URL=http://localhost:5173
command -v npm >/dev/null || . "$HOME/.nvm/nvm.sh"

# 用進度介面確認開著的是這個網站，不是別的專案佔了 5173
if ! curl -sf -o /dev/null "$URL/api/progress"; then
  mkdir -p data
  nohup npm run dev -- --port 5173 --strictPort > data/server.log 2>&1 &
  for _ in $(seq 50); do curl -sf -o /dev/null "$URL/api/progress" && break; sleep 0.2; done
  curl -sf -o /dev/null "$URL/api/progress" || { echo "伺服器沒有啟動，請看 data/server.log"; exit 1; }
fi
open "$URL"
