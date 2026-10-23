# 05 聖經故事插圖工作坊

- Repo（私人）：https://github.com/jessiechanchocoholic-web/biblestorygenerator（舊版：storygenerator-work）
- 平台：Lovable（TanStack Start + Supabase + Stripe，AI 經 Lovable AI gateway）
- 決定（2026-10-22）：留喺 Lovable，唔搬。之後修改由 Jj／Cursor 喺 GitHub 做，Lovable 經 GitHub 同步，慳 Lovable 改嘢 credits。
- 注意：修改前開分支，Jessie 批准先合併；`npm ci` 因 lockfile 唔同步會失敗，用 `npm install`。
- 狀態：
  - 2026-10-22：PR #1–#6（單張生成、主圖置中放大、漫畫修正生效、隱藏 11/8 圖解漫畫、最後晚餐 13 人等經文人數鎖定）已合併上線。
  - 2026-10-23：PR #7（`cc1e327`）已合併上線——主日福音預設改為只生「3 張主圖 + 1 張 A4 塗色線稿 + 圖解漫畫」，全面飛走 4 格分鏡圖（每期自動慳 3 張圖 Credits，舊期數已發佈分鏡仍向下相容顯示）；同時強化主圖與圖解漫畫「一擊即中」提示詞（2×2 清晰 4 格、禁止單格重複耶穌/角色、主圖純畫面禁亂碼字、擴充至 27 項常見主日福音人數及道具鎖定）。
