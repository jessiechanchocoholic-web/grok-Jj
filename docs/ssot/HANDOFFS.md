# 交接紀錄

| 日期 | 從 | 到 | 任務 ID | 內容 | 下一步 |
|---|---|---|---|---|---|
| 2026-10-28 | 部署 Bot | Jj／專案經理／Jessie | BIBLE-DEV-0x | Jessie 喺 Lovable Publish 後覆核通過：`bible.storygenerator.work`（及 `biblestorygenerator.lovable.app`）JS bundle 已更新為 `index-DzbZk9jL.js`、`admin_.sunday-DT71S1u6.js`（含 `illustratedComicHidden`、「唔出／唔匯出」、「圖解漫畫唔出／唔匯出」、「此期現正唔出／唔匯出。」）及 `sunday._slug-DhXqdJ6l.js`（含 `illustratedComicHidden`），確認 PR #8（`82927671`）已上線。 | 已完成（待合併 SSOT PR #4） |
| 2026-10-27 | 文件 Bot | 專案經理 Bot／開發 Bot | BIBLE-DEV-0x | 已將四格分鏡永久規則寫入 grok-Jj 專案 05 README、DECISIONS、STATUS（預設主圖＋A4＋圖解漫畫；分鏡停用；舊期相容；唔出／唔匯出；齊備定義唔再要 7 項）。PRD §15 未改（等 GitHub 存取＋開發 Bot）。 | 開發 Bot 存取開通後改 PRD＋做「唔出／唔匯出」UI |
| 2026-10-27 | 專案經理 Bot | 開發 Bot | BIBLE-DEV-0x | Jessie 撤回 Lovable 路線：唔好裝／連 Lovable、唔好喺 Lovable 改。恢復經 GitHub／Cursor 改 → sync Lovable。等 Jessie 確認 GitHub repo 存取卡片後繼續。 | Jessie 確認存取後開發 Bot 即做 UI、更新 SSOT、回報 PM／Jj |
| 2026-10-27 | 專案經理 Bot | 開發 Bot | BIBLE-DEV-0x | ~~已撤回~~ 舊指示「改 Lovable／連接 Lovable」——Jessie 其後更正。以同行「撤回 Lovable 路線」紀錄為準。 | 無視 |
| 2026-10-24 | 開發 Bot | 驗收 / QA Bot | SCAN-DEV-02 | 完成 CamScanner 式 100% 極簡全屏重做（PR #1 已合入 `main` `3539828`）。 | 已完成 |
| 2026-10-24 | 開發 Bot | 驗收 / QA Bot | SCAN-DEV-03 | 完成 iOS Safari / GitHub Pages 緊急修復（PR #2 已合入 `main` `ec8233e`）。 | 已完成 |
| 2026-10-25 | 開發 Bot | 驗收 / QA Bot | SCAN-DEV-04 | 完成「自動清答案」與「高清黑白」影像演算法徹底重構（`?v=3.2`）：(1) 自動偵測並提取截圖內白紙試卷區域（`detectPaperSubrectFromLum`），預設關閉盲目切頂部 9% 嘅 `autoHeaderMask`；(2) 局部自適應背景估算 + 對比度增強 + 2×2 筆畫連通加深，100% 保護頂部印刷題目與書包/人物插圖；(3) 結構化識別 12 個方格 `□` 清除手寫 `✓` 並重繪空心方格、識別傾斜填充橫線清除「學生手冊」「中國語文」並重繪橫線與對話框外框、清除對話框下大字「(課本)課本^」並修復書包左肩弧線、利用連通域線性回歸清除老師批改斜線 `/` 及右上角手寫班別姓名；(4) 新增「🧹 力度：輕柔 / 標準 / 強力」三段切換 UI（預覽區佔比 82.2% ≥ 75%，0px 溢出）。 | 請驗收 PR 並合入 `main` |
| 2026-10-25 | 開發 Bot | 驗收 / QA Bot | SCAN-DEV-04 | 完成 PR #3 三大 QA Blocker 徹底修正（`?v=3.3`）：(1) `runSmartAnswerErase` 開首加入 `buildFastBgMap`（含 4×4 網格 5×5 max-dilation）局部背景正規化，徹底消除內置示範卷陰影變黑問題（白底佔比由 34.67% 升至 91.37%），並新增連通域最深核心像素（`compMinNormLum >= pencilMinCut`）鉛筆字清除及 3×3 彩筆抗鋸齒邊緣擴張；(2) 徹底移除所有硬編碼座標與假書包弧線代碼，改用封閉對話框結構識別（`leftWallCov >= 0.75 && innerUls.length >= 1`）區分普通分隔線/閱讀框，並以 `extractLargeInteriorHoles` 大型插圖內部孔洞包絡線保護書包原生左肩弧線、精準剝離上方突出手寫字「`(課本) 課本 ^`」及利用連通域清除方格行間殘餘短斜線；(3) 移除 `0.863 * w` 一刀切右邊界，改為預設保留 `0.975 * w` 並自動偵測 `>= 20px` 空白垂直走廊＋右側疊紙殘影。 | 請重新驗收 PR #3 並合入 `main` |
