# 03 功課答案App

- **狀態**：慳錢版已完成，等 Jessie 貼入 Poe 試用
- **最後更新**：2026-10-22

## 目標
將 Poe canvas app「功課答案速查」（https://poe.com/Homework_ans）改成慳 credits 版本。現時用 `@Claude-Sonnet-5.5`，太貴。

## 計劃
- 加模型選擇：
  - `@GPT-4o-mini`（預設，最平）
  - `@Claude-Haiku-5.5`
  - `@Claude-Sonnet-5.5`（原本用開）
- 記住選擇（localStorage）、精簡 prompt、結果顯示邊個 AI 答

## 完成品
- [deliverables/功課答案速查-慳錢版.html](./deliverables/功課答案速查-慳錢版.html)
- 原檔係 Word 匯出嘅 HTML，已還原做純 code，內容完整（有 </html>，script 標籤齊）
- 改動：加「揀 AI」選單（預設 GPT-4o-mini）、localStorage 記住、prompt 精簡（數學保留列式步驟）、結果標題顯示 AI 名；其他不變
- `node --check` 通過

## 下一步
Jessie 將新 code 貼入 Poe app 試用。
