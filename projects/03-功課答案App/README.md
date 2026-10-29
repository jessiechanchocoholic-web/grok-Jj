# 03 功課答案App

- **狀態**：HW-UX-02 已上線（Jessie 已 Publish；主標題 `### 學生列式答案`）
- **最後更新**：2026-10-29（Asia/Hong_Kong）
- **Live**：https://apptopub.com/app/homework-ans （AppToPub；繼續跟阿 Sir workflow）
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

約束：AppToPub／Poe workflow 不變；答對邏輯不變。homework-app 6 份 HTML/txt 同 deliverables md5 一致。

## Publish
Live 已由 Jessie Publish；一般唔使再 Publish。若要再出：開 https://apptopub.com/app/homework-ans → 貼 canonical 全文 → Preview → Publish。

## 完成品
- [deliverables/功課答案速查-慳錢版.html](./deliverables/功課答案速查-慳錢版.html)
- Canonical：`/workspace/homework-app/Homework_ans.html`
- 同步：`Homework_ans_code.txt`、`功課答案速查-慳錢版.html`、`功課答案速查-慳錢版-code.txt`、`功課答案速查-自動縮圖版-code.txt`、`一鍵複製功課App-Code.html`

## 下一步
QA 用面積列式真題抽樣驗「學生列式答案」格式。
