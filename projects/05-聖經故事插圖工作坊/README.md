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
5. **新批次圖片方向預設 A4 直向**（主日福音圖管理「全部圖片方向」；PR #13／2026-11-02）。主圖與 A4 線稿跟同一選擇；舊圖／已存 orientation 不變；重生成跟已存方向，缺則橫向。PRD／SSOT 必須保持此規則，唔使 Jessie 再講。

> 備註：PR #8（`82927671`）已更新 `docs/PRD.md` §15（發佈門檻主圖＋A4；圖解漫畫「唔出／唔匯出」），並已隨 Lovable Publish 同步上線（2026-10-28 部署覆核通過）。

## 狀態

- 2026-10-22：PR #1–#6（單張生成、主圖置中放大、漫畫修正生效、隱藏 11/8 圖解漫畫、最後晚餐 13 人等經文人數鎖定）已合併上線。
- 2026-10-23：PR #7（`cc1e327`）已合併上線——主日福音預設改為只生「3 張主圖 + 1 張 A4 塗色線稿 + 圖解漫畫」，全面飛走 4 格分鏡圖（每期自動慳 3 張圖 Credits，舊期數已發佈分鏡仍向下相容顯示）；同時強化主圖與圖解漫畫「一擊即中」提示詞（2×2 清晰 4 格、禁止單格重複耶穌/角色、主圖純畫面禁亂碼字、擴充至 27 項常見主日福音人數及道具鎖定）。
- 2026-10-27：永久規則已寫入本 README 及 grok-Jj SSOT（DECISIONS／STATUS／HANDOFFS）。
- 2026-10-28：BIBLE-DEV-0x **已完成並上線**——PR #8 已 merge（`82927671`），Jessie 於 Lovable Publish 後，部署 Bot 覆核 `bible.storygenerator.work` 新 bundle（`admin_.sunday-DT71S1u6.js`、`sunday._slug-DhXqdJ6l.js`、`index-DzbZk9jL.js`）已包含 `illustratedComicHidden` 及「唔出／唔匯出」控制。

## Facebook 專頁排程（FB-BATCH-1122｜2026-11-22）

- 專頁：聖經故事插圖／動畫工作室（https://www.facebook.com/biblestorygenerator/）
- 來源：專案經理 Bot 轉達（2026-11-22）：Jessie 已批；Jj 已入 Meta（公開、目標出帖 **HKT 08:00**；介面顯示**前一日 19:00**）。唔即時 Publish。
- 定稿：`/workspace/fb-batch-2026-11-21/drafts-v2.md`
- 交接：`/workspace/fb-batch-2026-11-21/jj-handoff-2026-11-22.md`
- 排位規則（定稿引用）：`/workspace/fb-batch-2026-11-21/layout-rules.md`
- 圖檔只記路徑，**唔 commit 入本 repo**。
- 註：定稿／交接檔寫作時，窗內新帖多處標「尚未入 Meta」（當時係交 Jj 入稿用）。而家狀態以專案經理 Bot 2026-11-22 轉達為準（下述 14 則已入）。以 2026-11-22 上午計，Business Suite 約 29 日窗大約到 **2026-12-21 HKT**。

### 已出

| 出帖（HKT） | 類型／主題 | 備註 |
|---|---|---|
| 2026-11-22（日）08:00 | 常年期基督君王 | 專案經理 Bot 轉達（2026-11-22）：今朝已出。交接檔標「只需確認已公開」。 |

### 已排 14 則（Jj 已入 Meta；公開、HKT 08:00）

| 出帖（HKT） | 類型／主題 | 圖路徑 | 今次動作 |
|---|---|---|---|
| 2026-11-25（三）08:00 | 將臨期前導｜認識將臨環（四枝，三紫一粉，無中央白燭） | `/workspace/fb-meta-pack/v2/2026-11-25-advent-wreath-youth.jpg`（已核對存在，3508×2480 JPEG；專案經理 Bot 轉達，來源：`/workspace/fb-handover-2026-11-14.md`：Jessie 交青少年版） | 較早前已入 Meta，今次無改文案同圖。公開、HKT 08:00。文案：`/workspace/fb-meta-pack/v2/caption-2026-11-25-advent.txt`。金句：依 9:1。 |
| 2026-11-29（日）08:00 | 將臨期第一主日 | — | 已在 Meta，今次無改排位／文案 |
| 2026-11-30（一）08:00 | 聖安德肋宗徒慶日 | `/workspace/fb-batch-2026-11-21/saints/2026-11-30-st-andrew.jpg` | 窗內新入（當時最急） |
| 2026-12-02（三）08:00 | 將臨期第一主日跟進｜第1枝紫色蠟燭 | `/workspace/fb-meta-pack/v2/2026-12-02-advent-wreath-hope-1lit-youth.jpg`（已核對存在，3508×2480 JPEG；專案經理 Bot 轉達，來源：`/workspace/fb-handover-2026-11-14.md`：Jessie 交，只亮第1枝） | 較早前已入 Meta，今次無改文案同圖。公開、HKT 08:00。文案：`/workspace/fb-meta-pack/v2/caption-2026-12-02-advent.txt`。金句：谷 13:37。 |
| 2026-12-03（四）08:00 | 聖方濟．沙勿略司鐸慶日（香港教區） | `/workspace/fb-batch-2026-11-21/saints/2026-12-03-st-francis-xavier.jpg` | 窗內新入 |
| 2026-12-06（日）08:00 | 將臨期第二主日 | — | 已在 Meta，今次無改排位／文案 |
| 2026-12-08（二）08:00 | 聖母無玷始胎（香港教區主保） | `/workspace/fb-batch-2026-11-21/saints/2026-12-08-immaculate-conception.jpg` | 窗內新入 |
| 2026-12-09（三）08:00 | 推廣（構想 A） | `/workspace/fb-promo-1209/v2/concept-a-advent-3steps.jpg`（已核對：1080×1350 JPEG） | 窗內新入。構想 B 未採用（`/workspace/fb-promo-1209/v2/concept-b-classroom-atmosphere.jpg`）。構想 A 文案（包括「今日亦係主教座堂奉獻慶日」括號句）一字不改；推廣帖網址前唔加 👉 |
| 2026-12-12（六）08:00 | 將臨期第三主日備課 | `/workspace/fb-batch-2026-11-21/2026-12-12-adv3-prep-witness.jpg` | 只更新排位文案（圖、時間不變）。金句已用思高若 1:8 全文「只是為給那光作證」 |
| 2026-12-13（日）08:00 | 將臨期第三主日（喜樂主日）輪播 | 先前入稿：`/workspace/fb-meta-pack/v2/2026-12-13-advent-wreath-joy-3lit-youth.jpg` ＋ `/workspace/fb-meta-pack/12-13-adv3-main.png`（見 `/workspace/fb-meta-enter-1213.md`；本批定稿／交接標今次無改） | 已在 Meta，今次無改排位／文案。金句仍是「只是為光作證」，**待 Jessie 決定（經專案經理 Bot 提問）**要不要改成思高全文「只是為給那光作證」 |
| 2026-12-16（三）08:00 | 喜樂金句 | `/workspace/fb-batch-2026-11-21/2026-12-16-joy-quote-card-v3.jpg` | 只更新排位文案（圖、時間不變；確認用 v3）。金句用思高若 1:8 全文。此則無 hashtag |
| 2026-12-17（四）08:00 | 大對經開始｜上主的智慧 | `/workspace/fb-batch-2026-11-21/saints/2026-12-17-o-sapientia.jpg`（已核對：1080×1350 JPEG；3:4 原圖 `saints/source-3x4/2026-12-17-o-sapientia-3x4.jpg`） | 窗內新入。定稿為建議版，金句依以賽亞 11:2。舊葉瑟樹稿（依 11:1，圖 `saints/2026-12-17-o-antiphons.jpg`）未採用，保留備查 |
| 2026-12-19（六）08:00 | 將臨期第四主日備課 | `/workspace/fb-batch-2026-11-21/2026-12-19-adv4-prep-willing.jpg` | 只更新排位文案（圖、時間不變） |
| 2026-12-20（日）08:00 | 將臨期第四主日（輪播） | 1. `/workspace/fb-batch-2026-11-21/12-20-adv4-main.png` 2. `/workspace/fb-batch-2026-11-21/12-20-adv4-life.png` | 窗內新入。此則無 hashtag |

### 已批、窗外，等 fb-meta 續排（12/24 至 1/10）

以 2026-11-22 上午計超出約 29 日窗。專案經理 Bot 轉達（2026-11-22）：Jessie 已批；窗推進後由近到遠再排，仍然公開、HKT 08:00。

| 出帖（HKT） | 類型／主題 | 圖路徑 | 備註 |
|---|---|---|---|
| 2026-12-24（四）08:00 | 將臨蠟燭（聖誕前夕） | `/workspace/fb-batch-2026-11-21/2026-12-24-advent-wreath-all4lit-youth.jpg` | 四枝全亮（三紫一粉，無中央白蠟燭）。朝早仍屬將臨期，文案用若 1:9，唔用路 2:11 |
| 2026-12-25（五）08:00 | 耶穌聖誕 | `/workspace/fb-batch-2026-11-21/12-25-xmas-main.png` | 已批不改圖（圖內標題或仍寫「耶穌聖誕節／子夜彌撒」）；文案標「耶穌聖誕」，金句指路 2:11 思高原文。此則無 hashtag |
| 2026-12-26（六）08:00 | 聖家節備課 | `/workspace/fb-batch-2026-11-21/2026-12-26-holyfamily-prep.jpg` | 已批保留此則 |
| 2026-12-27（日）08:00 | 聖家節（輪播） | 1. `/workspace/fb-batch-2026-11-21/2026-12-27-holy-family-main.jpg` 2. `/workspace/fb-batch-2026-11-21/12-27-holyfamily-life.png` | 先西默盎迎接聖嬰主圖，再生活卡。此則無 hashtag |
| 2026-12-28（一）08:00 | 諸聖嬰孩慶日 | `/workspace/fb-batch-2026-11-21/saints/2026-12-28-holy-innocents.jpg` | 聖家逃往埃及；圖內無字、無暴力、無士兵。金句用瑪 2:14 |
| 2027-01-01（五）08:00 | 天主之母聖瑪利亞 | `/workspace/fb-batch-2026-11-21/01-01-mother-main.png` | 此則無 hashtag |
| 2027-01-02（六）08:00 | 主顯節備課 | `/workspace/fb-batch-2026-11-21/2027-01-02-epiphany-prep-share.jpg` | |
| 2027-01-03（日）08:00 | 主顯節 | `/workspace/fb-batch-2026-11-21/01-03-epiphany-main.png` | 只用賢士朝拜主圖，生活卡留俾 1/6。此則無 hashtag |
| 2027-01-06（三）08:00 | 主顯節跟進（平日金句） | `/workspace/fb-batch-2026-11-21/01-03-epiphany-life.png` | 單出 1/3 留低嘅生活卡。此則無 hashtag |
| 2027-01-09（六）08:00 | 主受洗節備課 | `/workspace/fb-batch-2026-11-21/2027-01-09-baptism-prep-blessing.jpg` | |
| 2027-01-10（日）08:00 | 主受洗節 | `/workspace/fb-batch-2026-11-21/2027-01-10-baptism-of-the-lord-main.jpg` | 此則無 hashtag |

### 暫不入

| 出帖目標（HKT） | 類型／主題 | 狀態 |
|---|---|---|
| 2027-01-11（一）08:00 | 工作室推廣｜常年期再起步 | 文案已定稿（已按 layout-rules 乙補慣用三行 CTA：完整網址無 👉，hashtag 緊接）。圖**未定**，臨近先交 Jessie 睇（經專案經理 Bot），唔用舊截圖，暫不入 Meta。 |

### 待 Jessie 決定（經專案經理 Bot 提問）

- **12/13 金句**：現時文案仍是「只是為光作證」（見 `/workspace/fb-meta-enter-1213.md`）。要不要改成思高全文「只是為給那光作證」（12/12、12/16 已用此全文）尚未決定。本批定稿／交接標 12/13 今次無改排位，冇寫呢項決定。

### 未採用（唔好入 Meta）

- 12/9 構想 B：`/workspace/fb-promo-1209/v2/concept-b-classroom-atmosphere.jpg`
- 12/17 舊葉瑟樹稿（依 11:1）：`/workspace/fb-batch-2026-11-21/saints/2026-12-17-o-antiphons.jpg`
