# 03 功課答案App

- **狀態**：已上線（Cloudflare Workers；HW-UX-02 已完成）
- **最後更新**：2026-11-08
- **Live**：https://hw-answer.jessiechan.workers.dev（Cloudflare Worker `hw-answer`；repo `homework-ans`；Poe API `Claude-Haiku-5.5`）
- **密碼**：有 `APP_PASSWORD`（Worker secret；值唔入 repo）
- **限制**：唔限流、唔限容量、唔限答案長度
- **寄存說明**：[`docs/HOSTING.md`](../../docs/HOSTING.md)
- **舊平台**：AppToPub https://apptopub.com/app/homework-ans 已停用。下面 HW-UX 小節係舊紀錄。
- **Canonical**：`/workspace/homework-app/Homework_ans.html`
- **參考**：Jessie 第7題學生手寫（`/workspace/homework-app/hw-ux-02-student-format-ref.jpg`）

## 目標
幫學生／老師快速睇功課答案；輸出跟香港小學學生列式；隱藏 thinking、唔顯示 code。

## 已完成：HW-UX-02（Jessie 經 Jj → 專案經理 → 開發 Bot｜2026-10-29）

### 學生列式答案規格（對齊第7題；圓角方框內）
```
30 × 30 − 12 × 12 − 18 × 18 ÷ 2
= 900 − 144 − 162
= 756 − 162
= 594
右圖的面積是 594 cm²。
```
- 第一行：完整橫式算式
- 其後每行以 `=` 開頭逐步簡化（`=` 垂直對齊）
- 最後一行：完整中文答案句＋單位

### 本地實作（以 canonical 磁碟為準｜Jj 最終版）
| 層 | 內容 |
|---|---|
| Prompt | 禁 thinking／code fence；文字／列式題必出 `### 學生列式答案`（格式如上）；UI 兼認舊標題「列式步驟答案／答案格」 |
| CSS／UI | `.answer-box`／`.student-work`／`.work-steps` 圓角灰框；`.student-lines`＋`.eq-line.is-eq` 令 `=` 對齊；顯示標題優先「學生列式答案」 |
| Sanitize | 保留 HW-UX-01 `sanitizeModelOutput`；`formatStudentWorkLines` 整理列式行 |

約束（2026-10-29 當時範圍）：跟當時 AppToPub／Poe workflow；答對邏輯不變。homework-app 6 份 HTML/txt 同 deliverables md5 一致。現況已搬 Cloudflare，見頂部。

## Publish（舊 AppToPub，已停用）
下面步驟只適用舊平台。現況見頂部 Cloudflare Live，同 [`docs/HOSTING.md`](../../docs/HOSTING.md)。舊步驟：開 https://apptopub.com/app/homework-ans → 貼 canonical 全文 → Preview → Publish。

## 完成品
- [deliverables/功課答案速查-慳錢版.html](./deliverables/功課答案速查-慳錢版.html)
- Canonical：`/workspace/homework-app/Homework_ans.html`
- 同步：`Homework_ans_code.txt`、`功課答案速查-慳錢版.html`、`功課答案速查-慳錢版-code.txt`、`功課答案速查-自動縮圖版-code.txt`、`一鍵複製功課App-Code.html`

## 下一步
等 Jessie 批 [PR #6](https://github.com/jessiechanchocoholic-web/grok-Jj/pull/6) merge（唔好自行合）。
