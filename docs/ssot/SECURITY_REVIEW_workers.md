# 安全審核：Cloudflare Workers 兩個 App（SEC-WORKERS-01）

- 審核人：安全 Bot（唯讀；冇改 code、冇部署、冇郁 Cloudflare）
- 日期：2026-11-08（香港/東京時間凌晨）
- 範圍：`homework-ans` @ `9c8c8f4`（https://hw-answer.jessiechan.workers.dev）；`catechesis-reference-search` @ `6d5684e`（https://ref-search.jessiechan.workers.dev）
- 網上實測只做咗無害請求（GET 靜態路徑、OPTIONS、空 body／錯格式 POST），**冇發任何會扣 Poe 點數嘅請求**，冇壓力測試。
- 本報告唔包含任何密鑰值，只寫位置。

## 總結

| 項目 | 功課 App（hw-answer） | 資料搜尋器（ref-search） |
|---|---|---|
| a) Key 外洩 | 通過（低） | 通過（低） |
| b) /api 濫用 | **高**：公開 Poe 代理，冇驗證、冇限流 | **中**：冇驗證、冇限流，但 prompt 由伺服器砌 |
| c) 靜態檔 | 通過 | 低：`/api/download-package` 公開原始碼 zip（冇密鑰） |
| d) 相依套件 | 低：jsDelivr `marked` 冇 SRI、冇鎖版本 | 通過：npm audit 0 漏洞；Google Fonts 只係 CSS |

**原本有高風險（功課 App `/api/chat` 冇保護）；已由 PR #3 加密碼緩解，見文末「更新」。**

## a) Key 外洩

- 兩個 repo 全部 git 歷史（`git log --all -p`）用正則搜 Poe/OpenAI 式 key、Bearer token、`*_API_KEY=` 明文：冇真 key。只有範例佔位符：`catechesis-reference-search/.dev.vars.example`、`.env.example`（`YOUR_POE_API_KEY`、`MY_GEMINI_API_KEY`）；`homework-ans` 歷史曾有 `.dev.vars.example`（`sk-or-xxxx` 佔位符，已刪）。
- `.dev.vars`／`.env` 從未 commit；兩個 `.gitignore` 都有排除。
- `wrangler.jsonc` 兩個都只有 `MODEL` 等普通 vars，冇密鑰；key 只靠 Worker Secret `POE_API_KEY`（`src/worker.js` 第 17 行、`worker/poe.ts` `requireKey`）。
- 前端：`homework-ans/public/index.html`、線上 `/`、ref-search 線上 bundle `/assets/index-CzBLcEB3.js` 搜過，冇 key、冇 `api.poe.com`、冇 Bearer。
- 註：未裝 gitleaks，用正則搜尋代替。

## b) /api 濫用

### 功課 App `src/worker.js` — 高
- 冇任何驗證（密碼／Access／Turnstile）、冇限流、冇 Origin 檢查。
- 用戶可傳完整 `messages`（包括自己嘅 system prompt），最多 20 條、最大 15MB → 等於一個免費公開嘅 Claude 代理，唔限於做功課。
- `model` 可由用戶揀，但有白名單（`Claude-Haiku-5.5`、`Claude-Sonnet-5.5`），即係可以揀較貴嘅 Sonnet。
- 冇 `max_tokens` 上限。
- CORS：冇回 `Access-Control-Allow-Origin`，OPTIONS 回 405 → 其他網站嘅瀏覽器 JS 用唔到，但 curl／腳本完全唔受影響。
- 錯誤訊息：上游錯誤會原文附上 `j.error.message`（第 38 行），唔會含 key，但會透露上游錯誤內容（低）。
- SSRF：冇，只 fetch 固定 Poe URL。

### 資料搜尋器 `worker/index.ts` — 中
- 冇驗證、冇限流、冇 Origin 檢查；`/api/search/custom`、`/api/search/web`、`/api/process-file`、`/api/ocr-pages` 全部公開。
- 好處：model 由伺服器 vars 決定，用戶揀唔到；prompt 由伺服器砌，唔係任意代理。
- 輸入限制：body 上限 50MB（`readBody`）；每份文件只取 15000 字，但**文件數量冇上限**，`query` 長度冇上限 → 一次請求可以好貴。OCR 每次最多 3 頁、每頁 1.2M 字元（`worker/ocr.ts`）。
- 錯誤：`publicPoeError` 會遮走 Bearer／`sk-` 字串並截 300 字，做得好。`poe.ts` 用 `redirect: "manual"` 防 key 跟住轉址外洩，做得好。
- SSRF：Worker 冇 fetch 用戶提供嘅 URL；Web-Search 由 Poe 端執行 → 冇 SSRF。

### 建議（按優先次序）
1. **功課 App 即時**：加 Cloudflare Rate Limiting binding（例如每 IP 每分鐘 5–10 次），或者 Cloudflare Access／簡單共享密碼 header；伺服器固定 system prompt，只接受用戶圖片＋問題，唔好收任意 `messages`；限 `max_tokens`；考慮淨係用 Haiku。
2. 兩個 App 都檢查 `Origin`／`Referer` 係自己網域（擋唔到腳本，但減少盜用）。
3. 公開俾學生用嘅話，考慮 Turnstile。
4. ref-search：限 `documents` 數量（例如 ≤ 20）同 `query` 長度（例如 ≤ 500 字）。
5. Poe 帳戶設每月用量／點數提醒。

## c) 靜態檔

- hw-answer：試 `/.env`、`/.dev.vars`、`/wrangler.jsonc`、`/wrangler.toml`、`/package.json`、`/.git/config`、`/src/worker.js`、`/index.html.bak`、`*.map` 全部 404。`public/` 只有 `index.html`。通過。
- ref-search：上述路徑全部回 SPA `index.html`（`not_found_handling: single-page-application`），冇洩漏內容；bundle 冇 `.map`。通過。
- 低風險：`GET /api/download-package` 公開下載原始碼 zip（約 90KB）。檢查過內容只有 repo 原始碼同範例檔，冇 `.env`／`.dev.vars`／PDF／密鑰（`scripts/package.mjs` 有排除規則及密鑰檢查）。但 zip 係 build 時從本機資料夾打包，日後本機多咗私人檔有機會被打包；repo 本身已公開，建議如非必要就移除此端點。

## d) 相依套件

- ref-search：`npm audit --package-lock-only` → 0 漏洞。外部只有 Google Fonts CSS（無 script）。
- hw-answer：冇 npm 依賴；`public/index.html` 第 9 行由 jsDelivr 載入 `marked`，**冇鎖版本、冇 SRI** → 低至中風險（CDN／套件被入侵可執行任意 JS）。輸出經 `marked.parse` 後寫入 `innerHTML`（約第 743–758 行），內容嚟自 AI 回應，屬低風險 XSS 面。建議鎖版本＋加 `integrity`／`crossorigin`，或者自行 host，並考慮 DOMPurify。

## 更新（2026-11-08）：功課 App 已加密碼（homework-ans PR #3）

唯讀審核 [homework-ans PR #3](https://github.com/jessiechanchocoholic-web/homework-ans/pull/3)（head `7b7d8ac`，已合併入 `main` 為 `5a1f3d6`）。

- **驗證做法**：前端彈出密碼框，學生輸入後存喺瀏覽器 `localStorage`（key `hw_app_password`），每次請求用 header `X-App-Password` 傳去 Worker；Worker 回 401 時前端清走並要求重新輸入。
- **常數時間比對**：有。`src/worker.js` `safeEqual()` 先將兩邊做 SHA-256，再用 `crypto.subtle.timingSafeEqual` 比對（長度唔同都唔會洩漏時間差）。
- **密碼存放**：伺服器端讀 `env.APP_PASSWORD`（Worker secret）；`wrangler.jsonc` 冇列出、repo 全歷史搜過冇明文密碼。前端程式碼冇寫死密碼。
- **有冇封晒 /api**：有。Worker 只有 `/api/chat` 一個 API，驗證喺讀取 body 同用 Poe key 之前；未設 `APP_PASSWORD` 時回 503（fail-closed，唔會變成冇密碼都用到）。
- **部署狀態**：已合併並已部署。線上無害測試（空 body、錯密碼）都回 503「老師未設定 APP_PASSWORD」→ **線上 Worker secret `APP_PASSWORD` 仲未設定，學生而家用唔到 `/api/chat`**。冇發任何扣點數請求。

### 殘餘風險
- 共用密碼：任何知道密碼嘅人（學生轉傳）都可用；冇限流，所以密碼外流後仍可大量用 Poe 點數。（中）
- 密碼以明文存喺學生裝置 `localStorage`，共用電腦上其他人睇得到。（低）
- PR #3 同時刪咗 15MB 請求大小上限（`MAX_BYTES`），而家 body 冇上限（Cloudflare 平台本身仍有上限）；仍可揀 Sonnet、冇 `max_tokens`。（低–中）
- 錯誤密碼冇次數限制，弱密碼可被暴力猜中 → 建議用長密碼（例如 12 字以上）。（中）
- `marked` CDN 冇 SRI 仍未改。（低–中）

### Jessie 決定（風險已接受）
- 功課 App：**唔加**限流、請求大小上限、`max_tokens` 上限；接受以上殘餘風險。
- 資料搜尋器（ref-search）：**維持現狀**，接受第 b) 節所列中風險（冇驗證、冇限流）。

更新後評級：功課 App `/api/chat` 由「高」降為「中（已接受）」；資料搜尋器「中（已接受）」。
