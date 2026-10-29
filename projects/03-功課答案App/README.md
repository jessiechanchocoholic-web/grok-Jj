# 03 功課答案App

- **狀態**：HW-UX-01 已完成（等 Jessie 喺 AppToPub Publish）
- **最後更新**：2026-10-29（Asia/Hong_Kong）
- **Live**：https://apptopub.com/app/homework-ans （AppToPub；繼續跟阿 Sir workflow）

## 目標
幫學生／老師快速睇功課答案；輸出顯示已優化：隱藏 thinking、唔顯示 code、數學題必有「列式步驟答案」。

## 已完成：HW-UX-01（Jessie 經 Jj → 專案經理 → 開發 Bot）
1. **Thinking／推理**：prompt 禁止輸出；render 用 `sanitizeModelOutput` 剝 `<thinking>`／`<think>`／reasoning fence／「Thinking:」長段（串流＋complete）。
2. **列式步驟答案**：prompt 要求每道數學題最後用 `### 列式步驟答案`；UI 用 `.work-steps`／`.work-steps-title` 醒目區塊。
3. **Code 唔顯示**：剝／拆開 fenced code；CSS 隱藏殘餘 `<pre>`；數學用文字列式。

約束：繼續 AppToPub／Poe workflow（唔遷移 Cloudflare／外部 API）。答對邏輯不變，只改顯示／prompt／UI。

成功標準：一睇就見答案／列式步驟；唔使碌長 thinking；畫面冇 code 區塊。

## Jessie Publish 步驟（AppToPub）
1. 開 https://apptopub.com/app/homework-ans （或 AppToPub 入面「homework-ans」呢個 app）
2. 用編輯／貼 code：貼上本地檔 **`/workspace/homework-app/Homework_ans.html`** 全部內容  
   （或開 `一鍵複製功課App-Code.html` 撳「一鍵複製全部 Code」再貼）
3. Preview 確認：答案卡有「列式步驟答案」醒目區、冇 thinking／code block
4. 撳 **Publish** 上線

## 改動摘要
| 層 | 改動 |
|---|---|
| Prompt | 禁 thinking／code block；數學必有 `### 列式步驟答案` |
| Render | `sanitizeModelOutput` + `enhanceAnswerHtml`；串流／history 共用 |
| CSS／UI | `.work-steps` 醒目區；隱藏殘餘 `pre` |

## 完成品
- [deliverables/功課答案速查-慳錢版.html](./deliverables/功課答案速查-慳錢版.html)
- 本地 canonical：`/workspace/homework-app/Homework_ans.html`
- 同步副本：`Homework_ans_code.txt`、`功課答案速查-慳錢版.html`、`功課答案速查-慳錢版-code.txt`、`功課答案速查-自動縮圖版-code.txt`、`一鍵複製功課App-Code.html`

## 計劃（慳錢版，已完成）
- 加模型選擇：`@GPT-4o-mini`／`@Claude-Haiku-5.5`（預設）／`@Claude-Sonnet-5.5`
- 記住選擇（localStorage）、精簡 prompt、結果顯示邊個 AI 答
- 自動縮圖（最長邊 1600px）避免傳送超時

## 下一步
Jessie 喺 AppToPub Publish → QA 用真題抽樣驗顯示。
