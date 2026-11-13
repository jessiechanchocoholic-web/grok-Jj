# 協作規範

## 團隊鐵規：只有專案經理 Bot 可向 Jessie 提問（2026-11-13）
- 只有**專案經理 Bot**一個可以問 Jessie 嘢或者叫佢覆。
- 開發、QA、安全、文件、部署 Bot 同 **Jj** 都只可以報告畀專案經理 Bot；所有問題、批准申請同報告一律發畀專案經理 Bot，**唔准直接同 Jessie 講或者叫佢覆**。
- Jessie 嘅答覆經專案經理 Bot 轉達先算數。
- 呢條取代 2026-11-08「經 Jj 或專案經理 Bot 集中問」嘅版本（Jj 唔再係提問渠道）。

## 分支命名
- 新功能：`feat/<task-id>-簡短描述`（例：`feat/T-001-login-page`）
- 修正：`fix/<task-id>-簡短描述`
- 文件：`docs/<task-id>-簡短描述`
- 雜項：`chore/<task-id>-簡短描述`

## PR 規則
- PR 標題及描述必須連結任務 ID（例：`[T-001] 新增登入頁面`）
- 合併前必須經 QA Bot 及安全 Bot 審查通過
- 嚴禁提交任何機密資料（API key、token、密碼、.env）
- 重要變更與部署須 Jessie 批准
- 不可直接推送至 main（初始設定除外）

## 狀態更新規則
- 任務狀態一有變化，負責 Bot 須即時更新 STATUS.md 及更新日期
- 狀態只可用：待辦 / 進行中 / 審查中 / 完成 / 阻塞；阻塞須在備註寫明原因
- 重要決定記錄於 DECISIONS.md，並標示 Jessie 審批狀態
- 任務轉手時須在 HANDOFFS.md 新增一列，寫明下一步

## 接手指引
任何 AI 平台接手時：先讀 README.md → STATUS.md → 最近的 HANDOFFS.md → DECISIONS.md，再依本規範工作。
