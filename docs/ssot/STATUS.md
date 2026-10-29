# 任務看板

狀態只可使用：待辦 / 審查中 / 進行中 / 完成 / 阻塞

| ID | 任務 | 負責 Bot | 狀態 | 更新日期 | 備註 |
|---|---|---|---|---|---|
| SCAN-DEV-02 | 試卷掃描清答案 App：100% CamScanner 式極簡全屏重做（無限文檔庫 IndexedDB + 連續快拍 + 四角透視裁切 + 4大濾鏡 + 浮動手動塗改 + Web Share/PDF預覽/下載位置指引） | 開發 Bot | 完成 | 2026-10-24 | PR #1 已通過 QA 審查並合入 `main` (`3539828`) |
| SCAN-DEV-03 | 試卷掃描清答案 App：緊急修復 iOS Safari / GitHub Pages 舊 Cache (`?v=3.1`)、`<input type="file">` 原生 `<label for>` 觸發、IndexedDB 800ms 防卡死保底、按住睇原圖放手還原、手動塗改隨旋轉 90° 座標同步及 320px 超細屏零溢出 | 開發 Bot | 完成 | 2026-10-24 | PR #2 已通過 QA 審查並合入 `main` (`ec8233e`) |
| SCAN-DEV-04 | 徹底重構「自動清答案」與「高清黑白」影像演算法（解決鉛筆工作紙誤刪題目/插圖及殘留手寫剔號 `✓`、斜線 `/`、橫線手寫字與大字批註問題，新增輕柔/標準/強力三段力度控制，`?v=3.3`） | 開發 Bot | 審查中 | 2026-10-25 | 6 階段通用結構化 + 連通域智能清答案演算法（v3.3 修復 PR #3 三大 Blocker：局部背景漂白 + 連通域核心暗度清鉛筆 + 移除硬編碼座標與假弧線 + 自適應走廊右邊界）；內置示範卷（91.37% 純白底）與 Jessie P.1 實測圖（92.66% 純白底）雙雙 100% 通過；雙目錄 0 diff |
| BIBLE-DEV-0x | 恢復「唔出／唔匯出」掣（只 UI）+ 更新 `docs/PRD.md` §15 | 部署 Bot | 完成 | 2026-10-28 | GitHub `main` 已合入 PR #8（merge `82927671`）。Jessie 喺 Lovable Publish 後，**線上已跟上**：`bible.storygenerator.work`（及 `biblestorygenerator.lovable.app`）bundle 已更新為 `index-DzbZk9jL.js`、`admin_.sunday-DT71S1u6.js`（含 `illustratedComicHidden`、「唔出／唔匯出」、「圖解漫畫唔出／唔匯出」）、`sunday._slug-DhXqdJ6l.js`（含 `illustratedComicHidden`）。 |
| HW-UX-01 | 功課 App（AppToPub `homework-ans`）User Friendly：隱藏 thinking；數學列式步驟答案；唔顯示 thinking 內 code | 開發 Bot／QA Bot | 審查中 | 2026-10-29 | 開發完成（`79ff5b5`）；等 Jessie AppToPub Publish＋QA；SSOT/code PR https://github.com/jessiechanchocoholic-web/grok-Jj/pull/5 |
