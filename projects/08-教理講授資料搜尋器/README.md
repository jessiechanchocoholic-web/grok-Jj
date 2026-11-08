# 08 教理講授資料搜尋器

- **狀態**：已上線
- **最後更新**：2026-11-08

## 目標

教理講授資料搜尋。由 Google AI Studio 搬去 Cloudflare Worker `ref-search`（見 [`docs/HOSTING.md`](../../docs/HOSTING.md)）。

## 連結

- **Live**：https://ref-search.jessiechan.workers.dev
- **平台**：Cloudflare Workers；Worker 名 `ref-search`
- **Repo**：https://github.com/jessiechanchocoholic-web/catechesis-reference-search（`catechesis-reference-search`）
- **舊網址**：https://catechesis-reference-search.jessiechan.workers.dev 已停用
- **寄存說明**：[`docs/HOSTING.md`](../../docs/HOSTING.md)

## 進度／決定

- **密碼政策**：唔加密碼（Jessie 決定）。
- **Secrets／變數**（只記名稱，值唔入 repo）：
  - `MODEL`
  - `POE_API_KEY`（secret）
  - `WEB_SEARCH_MODEL`
- [`docs/HOSTING.md`](../../docs/HOSTING.md) 另記 `WEB_SEARCH_MODEL=Web-Search` 同 `VISION_MODEL`。

## 待做

本資料夾只作總目錄索引；程式同部署喺 repo `catechesis-reference-search`。

## 成品

線上：https://ref-search.jessiechan.workers.dev
