# 任務看板

狀態只可使用：待辦 / 審查中 / 進行中 / 完成 / 阻塞

| ID | 任務 | 負責 Bot | 狀態 | 更新日期 | 備註 |
|---|---|---|---|---|---|
| SCAN-DEV-02 | 試卷掃描清答案 App：100% CamScanner 式極簡全屏重做（無限文檔庫 IndexedDB + 連續快拍 + 四角透視裁切 + 4大濾鏡 + 浮動手動塗改 + Web Share/PDF預覽/下載位置指引） | 開發 Bot | 完成 | 2026-10-24 | PR #1 已通過 QA 審查並合入 `main` (`3539828`) |
| SCAN-DEV-03 | 試卷掃描清答案 App：緊急修復 iOS Safari / GitHub Pages 舊 Cache (`?v=3.1`)、`<input type="file">` 原生 `<label for>` 觸發、IndexedDB 800ms 防卡死保底、按住睇原圖放手還原、手動塗改隨旋轉 90° 座標同步及 320px 超細屏零溢出 | 開發 Bot | 審查中 | 2026-10-24 | 雙目錄 `scanner/` 與 `projects/07-試卷掃描清答案App/app/` 100% 同步；Playwright 320×568 / 375×667 / 390×844 全部 0 溢出、預覽區 ≥ 75.7%、0 console error |
