# 05 聖經故事插圖工作坊

- Repo（私人）：https://github.com/jessiechanchocoholic-web/biblestorygenerator（舊版：storygenerator-work）
- 平台：Lovable（TanStack Start + Supabase + Stripe，AI 經 Lovable AI gateway）
- 決定（2026-10-22）：留喺 Lovable，唔搬。之後修改由 Jj／Cursor 喺 GitHub 做，Lovable 經 GitHub 同步，慳 Lovable 改嘢 credits。
- Lovable↔GitHub 同步（官方 docs，2026-10-27 核實）：
  - **雙向自動同步**：Lovable 入面嘅改動會 commit／push 去已連結嘅 Git branch；推去**同一條 synced branch** 嘅 GitHub commits 會 sync 返 Lovable。
  - Lovable 一次只編輯／同步**一條 branch**（預設通常 `main`）；其他 branch 要 merge 入 synced branch 或者喺 Lovable 切換 synced branch 先會入到專案。
  - 心智模型：GitHub = 持久 repo／歷史；Lovable = 平台管理嘅專案副本／編輯器。雙方 diverge 時 Lovable 會把己方改動推去 `lovable-sync` branch，之後由 GitHub 端覆蓋回 synced branch（會先 backup）。
  - 出街站：`bible.storygenerator.work`（Lovable 部署；域名 Namecheap）。
- 決定（2026-10-27｜BIBLE-DEV-0x）：Jessie **撤回** Lovable 介面改站。約定恢復：**經 GitHub／Cursor 改 → sync 返 Lovable**（慳 Lovable credit）；唔裝／唔連 Lovable connector 做呢次 UI。
- 注意：修改前開分支，Jessie 批准先合併；`npm ci` 因 lockfile 唔同步會失敗，用 `npm install`。

## 永久規則（Jessie／Jj 已定｜唔使再問）

1. **預設只生**：主圖＋A4 塗色線稿＋圖解漫畫。**四格分鏡預設停用**（程式已落地：PR #7／`cc1e327`；`sundayAssetTasks` 預設 4 項；要舊版分鏡先設 `includeComic:true`）。
2. **舊期已發佈分鏡**：向下相容仍顯示；**新生成唔再生**四格分鏡。
3. **「唔出／唔匯出」**：圖解漫畫生成完後，用家可揀唔出／唔匯出（數量或細節唔準時）。屬永久 UI 規則，跟 BIBLE-DEV-0x 一齊寫入實作。
4. **發佈「齊備」**：跟新預設（主圖＋A4＋圖解漫畫等），**唔再要求**完整一期＝7 項（含 4 格分鏡）。

> 備註：`biblestorygenerator/docs/PRD.md` §15 仍滯後（寫「完整一期＝7 項」）。grok-Jj 以本頁為準；PRD 交開發 Bot 喺 GitHub 存取開通後一併改。

## 狀態

- 2026-10-22：PR #1–#6（單張生成、主圖置中放大、漫畫修正生效、隱藏 11/8 圖解漫畫、最後晚餐 13 人等經文人數鎖定）已合併上線。
- 2026-10-23：PR #7（`cc1e327`）已合併上線——主日福音預設改為只生「3 張主圖 + 1 張 A4 塗色線稿 + 圖解漫畫」，全面飛走 4 格分鏡圖（每期自動慳 3 張圖 Credits，舊期數已發佈分鏡仍向下相容顯示）；同時強化主圖與圖解漫畫「一擊即中」提示詞（2×2 清晰 4 格、禁止單格重複耶穌/角色、主圖純畫面禁亂碼字、擴充至 27 項常見主日福音人數及道具鎖定）。
- 2026-10-27：永久規則已寫入本 README 及 grok-Jj SSOT（DECISIONS／STATUS／HANDOFFS）。BIBLE-DEV-0x 仍阻塞——恢復圖解漫畫「唔出／唔匯出」掣（只 UI，經 GitHub／Cursor → sync Lovable）+ 更新 private repo `docs/PRD.md` §15；等 Jessie 確認 GitHub repo 存取後由開發 Bot 做。
