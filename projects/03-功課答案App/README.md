# 03 功課答案App

- **狀態**：HW-UX-01 進行中（User Friendly 顯示改動）
- **最後更新**：2026-10-29
- **Live**：https://apptopub.com/app/homework-ans （AppToPub；繼續跟阿 Sir workflow）

## 目標
幫學生／老師快速睇功課答案；現正優化輸出顯示，唔使碌長 thinking。

## 進行中：HW-UX-01（Jessie 經 Jj → 專案經理 → 開發 Bot）
必須全部做到：
1. Thinking／推理過程唔好完整 show 出嚟——可完全隱藏，或預設摺埋／唔渲染 thinking。
2. 所有涉及數式／列式嘅題：講解完之後，最後一定要有清晰「列式步驟答案」區塊。
3. Model thinking 入面出現嘅 code／程式碼，用戶完全唔需要見到——唔好顯示 code。

約束：繼續 AppToPub workflow（唔遷移 Cloudflare／外部 API）。答對邏輯保持，只改顯示與輸出格式／system prompt／UI。

成功標準：用戶一睇就見到答案／列式步驟；唔使碌過長 thinking；畫面冇 code 區塊。

## 計劃（慳錢版，已完成）
- 加模型選擇：`@GPT-4o-mini`（預設）／`@Claude-Haiku-5.5`／`@Claude-Sonnet-5.5`
- 記住選擇（localStorage）、精簡 prompt、結果顯示邊個 AI 答

## 完成品（參考）
- [deliverables/功課答案速查-慳錢版.html](./deliverables/功課答案速查-慳錢版.html)
- 本地參考：`/workspace/homework-app/Homework_ans.html`

## 下一步
開發 Bot 改 AppToPub app → QA 驗 → Jessie 喺 AppToPub Publish。
