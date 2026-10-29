# 03 功課答案App

- **狀態**：HW-UX-02 進行中（開發 Bot）；HW-UX-01 已 Publish live，但被 HW-UX-02 取代
- **最後更新**：2026-10-29（Asia/Hong_Kong）
- **Live**：https://apptopub.com/app/homework-ans （AppToPub；繼續跟阿 Sir workflow）
- **Canonical**：`/workspace/homework-app/Homework_ans.html`

## 目標
幫學生／老師快速睇功課答案；輸出跟香港小學學生列式；隱藏 thinking、唔顯示 code。

## 進行中：HW-UX-02（Jessie 經 Jj → 專案經理 → 開發 Bot｜2026-10-29）
答案格改香港小學學生列式格式：

1. **醒目答案格**（解釋之後必須有）：完整算式 → 多行 `=` 簡化 → 中文答案句連單位
2. **隱藏 thinking／唔顯示 code**（沿用／加強 HW-UX-01）
3. **AppToPub 不變**（唔遷移 Cloudflare／外部 API）
4. Canonical：`/workspace/homework-app/Homework_ans.html`；改完同步 deliverables

下一步：開發 Bot 改 prompt＋UI＋deliverables → 回 PM／Jj（Jessie Publish 步驟）。

## 已完成（已被取代）：HW-UX-01
Jessie 已 Publish live；顯示優化（隱藏 thinking、唔顯示 code、列式步驟答案）。**產品要求已升級為 HW-UX-02**，勿再當最終規格。

原改動摘要（參考）：
| 層 | 改動 |
|---|---|
| Prompt | 禁 thinking／code block；數學必有 `### 列式步驟答案` |
| Render | `sanitizeModelOutput` + `enhanceAnswerHtml` |
| CSS／UI | `.work-steps` 醒目區；隱藏殘餘 `pre` |

## Jessie Publish 步驟（AppToPub）
1. 開 https://apptopub.com/app/homework-ans （或 AppToPub 入面「homework-ans」）
2. 貼上 canonical **`/workspace/homework-app/Homework_ans.html`** 全部內容（或用一鍵複製頁）
3. Preview 確認答案格格式正確、冇 thinking／code
4. 撳 **Publish** 上線

## 完成品
- [deliverables/功課答案速查-慳錢版.html](./deliverables/功課答案速查-慳錢版.html)
- 本地 canonical：`/workspace/homework-app/Homework_ans.html`
- 同步副本：`Homework_ans_code.txt`、`功課答案速查-慳錢版.html`、`功課答案速查-慳錢版-code.txt`、`功課答案速查-自動縮圖版-code.txt`、`一鍵複製功課App-Code.html`

## 計劃（慳錢版，已完成）
- 加模型選擇：`@GPT-4o-mini`／`@Claude-Haiku-5.5`（預設）／`@Claude-Sonnet-5.5`
- 記住選擇（localStorage）、精簡 prompt、結果顯示邊個 AI 答
- 自動縮圖（最長邊 1600px）避免傳送超時
