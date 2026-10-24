# 交接紀錄

| 日期 | 從 | 到 | 任務 ID | 內容 | 下一步 |
|---|---|---|---|---|---|
| 2026-10-24 | 開發 Bot | 驗收 / QA Bot | SCAN-DEV-02 | 完成 CamScanner 式 100% 極簡全屏重做（PR #1 已合入 `main` `3539828`）。 | 已完成 |
| 2026-10-24 | 開發 Bot | 驗收 / QA Bot | SCAN-DEV-03 | 完成 iOS Safari / GitHub Pages 緊急修復：(1) 所有 CSS/JS 加上 `?v=3.1` 防舊 Cache + `window.ScannerProcessor`/`window.ExamProcessor` 雙別名保底；(2) 移除 `<input type="file">` 嘅 `hidden` 屬性改用 `.sr-file-input`，並將匯入相簿/PDF 及原生相機按鈕改為原生 `<label for="...">`（新增取景窗大掣 `📷 直接開啟手機相機拍照`），100% 不會被 iOS Safari 攔截；(3) `bindEvents()` 於 IndexedDB 前同步完成，並為 IndexedDB 加入 800ms timeout 防私密瀏覽/WebView 卡死；(4) 修復 QA 提出之 4 項細節：按住睇原圖放手自動還原、先手動塗改再旋轉 90° 筆觸像素級同步旋轉、320×568 頂部導航列 0px 溢出（預覽區佔比 75.70%）、`style.css` 與 `styles.css` 100% 同步。 | 請驗收 PR 並合入 `main` |
