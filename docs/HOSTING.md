# 寄存平台總覽（2026-11-08 更新）

Cloudflare 帳戶子網域：`jessiechan.workers.dev`（舊 `jessiechanchocoholic.workers.dev` 已停用）。唔改 GitHub 用戶名。

| App | 平台 | Repo | 網址 | 備註 |
|---|---|---|---|---|
| 功課 App | Cloudflare Worker `hw-answer` | `homework-ans`（前端 `public/`＋`src/worker.js`） | https://hw-answer.jessiechan.workers.dev | Poe API；secret `POE_API_KEY`；`MODEL=Claude-Haiku-5.5`；PR #1、#2 已合（後台＋列式方框修正）。舊 GitHub Pages／AppToPub 版停用 |
| 教理講授資料搜尋器 | Cloudflare Worker `ref-search` | `catechesis-reference-search` | https://ref-search.jessiechan.workers.dev | 由 Google AI Studio 搬出；build `npm run build`、deploy `npx wrangler deploy`；secret `POE_API_KEY`；變數 `MODEL`、`WEB_SEARCH_MODEL=Web-Search`、`VISION_MODEL`；PR #1、#2（Poe 後台、PDF/OCR、IndexedDB 匯出匯入）。預載文獻 6 篇；用戶課本要重新上載 |
| 溫習闖關遊戲 | GitHub Pages | `hk-revision-game` | — | 維持不搬 |
| 試卷掃描器 | GitHub Pages | `grok-Jj` | — | 維持不搬 |
| 教案、DSE、聖經故事工作室 | Lovable | — | — | 維持不搬 |

## 待辦
- Poe 年費 **2027-03-08** 到期前決定 AI 來源。
