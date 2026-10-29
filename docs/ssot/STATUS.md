# 任務看板

狀態只可使用：待辦 / 審查中 / 進行中 / 完成 / 阻塞

| ID | 任務 | 負責 Bot | 狀態 | 更新日期 | 備註 |
|---|---|---|---|---|---|
| SCAN-DEV-02 | 試卷掃描清答案 App：100% CamScanner 式極簡全屏重做（無限文檔庫 IndexedDB + 連續快拍 + 四角透視裁切 + 4大濾鏡 + 浮動手動塗改 + Web Share/PDF預覽/下載位置指引） | 開發 Bot | 完成 | 2026-10-24 | PR #1 已通過 QA 審查並合入 `main` (`3539828`) |
| SCAN-DEV-03 | 試卷掃描清答案 App：緊急修復 iOS Safari / GitHub Pages 舊 Cache (`?v=3.1`)、`<input type="file">` 原生 `<label for>` 觸發、IndexedDB 800ms 防卡死保底、按住睇原圖放手還原、手動塗改隨旋轉 90° 座標同步及 320px 超細屏零溢出 | 開發 Bot | 完成 | 2026-10-24 | PR #2 已通過 QA 審查並合入 `main` (`ec8233e`) |
| SCAN-DEV-04 | 徹底重構「自動清答案」與「高清黑白」影像演算法（解決鉛筆工作紙誤刪題目/插圖及殘留手寫剔號 `✓`、斜線 `/`、橫線手寫字與大字批註問題，新增輕柔/標準/強力三段力度控制，`?v=3.3`） | 開發 Bot | 審查中 | 2026-10-25 | 6 階段通用結構化 + 連通域智能清答案演算法（v3.3 修復 PR #3 三大 Blocker：局部背景漂白 + 連通域核心暗度清鉛筆 + 移除硬編碼座標與假弧線 + 自適應走廊右邊界）；內置示範卷（91.37% 純白底）與 Jessie P.1 實測圖（92.66% 純白底）雙雙 100% 通過；雙目錄 0 diff |
| BIBLE-DEV-0x | 恢復「唔出／唔匯出」掣（只 UI）+ 更新 `docs/PRD.md` §15（預設主圖＋A4＋圖解漫畫、分鏡停用、發佈齊備定義） | 開發 Bot | 阻塞 | 2026-10-27 | **產品規則已寫死**（grok-Jj 專案 05 README＋DECISIONS，2026-10-27）。實作仍阻塞：等 Jessie 真正授權 GitHub「加 repo 存取」；其後開發 Bot 經 GitHub／Cursor → sync Lovable 做 UI＋改 PRD §15。 |
| HW-UX-01 | 功課 App（AppToPub `homework-ans`）User Friendly：隱藏／摺埋 thinking；數學題末必須清晰列式步驟答案；唔顯示 model thinking 內 code；保持 AppToPub workflow 唔遷移 | 開發 Bot | 進行中 | 2026-10-29 | Live：https://apptopub.com/app/homework-ans ；只改顯示／輸出格式／system prompt／UI，答對邏輯不變 |
