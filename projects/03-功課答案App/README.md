# 03 功課答案App

- **狀態**：HW-UX-02 已完成（等 Jessie 喺 AppToPub Publish；開發唔自行 Publish）
- **最後更新**：2026-10-29（Asia/Hong_Kong）
- **Live**：https://apptopub.com/app/homework-ans （AppToPub；繼續跟阿 Sir workflow）
- **Canonical**：`/workspace/homework-app/Homework_ans.html`
- **參考**：Jessie 第7題學生手寫（`/workspace/homework-app/hw-ux-02-student-format-ref.jpg`）

## 目標
幫學生／老師快速睇功課答案；輸出跟香港小學學生列式；隱藏 thinking、唔顯示 code。

## 已完成：HW-UX-02（Jessie 經 Jj → 專案經理 → 開發 Bot｜2026-10-29）

### 答案格規格（對齊第7題；圓角方框內）
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

### 本地實作（以 canonical 磁碟為準）
| 層 | 內容 |
|---|---|
| Prompt | 禁 thinking／code fence；文字／列式題必出 `### 答案格`（格式如上）；UI 亦接受舊標題「學生列式答案／列式步驟答案」 |
| CSS／UI | `.answer-box`／`.student-work`／`.work-steps` 圓角灰框；`.student-lines`＋`.eq-line.is-eq` hanging indent 令 `=` 對齊；`.final-line` 中文句 |
| Sanitize | 保留 HW-UX-01 `sanitizeModelOutput`；`formatStudentWorkLines` 整理答案格行 |

約束：AppToPub／Poe workflow 不變；答對邏輯不變。

> **註**：開發過程曾覆寫過 Jj 中間版（主標題 `### 學生列式答案`）；現 canonical 主標題為 `### 答案格`，仍保留 `.student-work` class 同別名相容。一鍵複製頁同 canonical 一齊以而家磁碟為準，唔再覆寫。

## Jessie Publish 步驟（AppToPub｜只由 Jessie）
1. 開 https://apptopub.com/app/homework-ans
2. 貼上 **`/workspace/homework-app/Homework_ans.html`** 全文（或開 `一鍵複製功課App-Code.html` 複製）
3. Preview：圓角答案格、橫式→`=` 逐步→中文句、冇 thinking／code
4. 撳 **Publish**

## 完成品
- [deliverables/功課答案速查-慳錢版.html](./deliverables/功課答案速查-慳錢版.html)
- Canonical：`/workspace/homework-app/Homework_ans.html`
- 同步：`Homework_ans_code.txt`、`功課答案速查-慳錢版.html`、`功課答案速查-慳錢版-code.txt`、`功課答案速查-自動縮圖版-code.txt`、`一鍵複製功課App-Code.html`

## 下一步
Jessie Publish → QA 用面積列式真題抽樣驗答案格。
