# 06 教理教案一條龍平台（教案 ＋ 插圖 ＋ 工作紙 ＋ PPT）

- **狀態**：規劃分析中
- **相關 Repo**：
  - [catholic-lesson-planner](https://github.com/jessiechanchocoholic-web/catholic-lesson-planner)（天主教教理講授教案生成工具，HEAD / HEART / HANDS 框架，75 份教案範本）
  - [biblestorygenerator](https://github.com/jessiechanchocoholic-web/biblestorygenerator)（聖經故事插圖／圖解漫畫／塗色線稿工作坊，已備有登入、Credit 扣點及 Stripe 收費系統）
- **目標**：
  - 將「教理講授教案生成」與「聖經故事插圖工作坊」整合成一個面向前線導師／老師嘅一條龍備課平台（SaaS）：
    1. 輸入主題／經文／對象 ➔ 生成完整教案（認識 HEAD、明白 HEART、實踐 HANDS）
    2. 導師睇完覺得合適 ➔ 一鍵按教案內容自動生成：
       - **課堂插圖／圖解漫畫／A4 塗色頁**
       - **學生工作紙 PDF（附導師答案）**
       - **教學簡報 PPTX（或一鍵匯出 Gemini / NotebookLM 專用結構包）**
  - 商業模式：共用同一套帳戶與 Credit 點數／堂區年費訂閱，減輕前線導師備課工作量。

## 工作紀錄

### 2026-11-11：主日學「善牧耶穌」PPT 加細節版＋A4 棉花小羊工作紙（SS-GOODSHEPHERD-1111）

來源：Jessie 要求，經專案經理 Bot 派工，Jj 於 2026-11-11 轉達完成，交文件 Bot 記入。用嘅 skill：「主日學教案轉PPT」（ppt）。

**檔案位置（box `/workspace`，已確認存在）：**

- 教案：`/workspace/slides/good-shepherd-detail-ppQdmc/lesson.pdf`（工作紙資料夾 `/workspace/worksheet-lamb-MdelDL/lesson.pdf` 係同一份，md5 相同）
- PPT 加細節版：`/workspace/slides/good-shepherd-detail-ppQdmc/善牧耶穌_主日學_加細節版.pptx`
- A4 棉花小羊工作紙：`/workspace/worksheet-lamb-MdelDL/善牧小羊工作紙_A4.pdf`

**今次改動：**

- PPT：保留原圖；第 2、3、5、6、7、9、10、11、13、15、16 頁加咗教案文字咭；第 9 頁答案要撳先出。狀態：**完成**。
- 工作紙：QA 已查，冇錯字。狀態：文字 QA 通過；「光環改唔改、寫名指示等」仲等 Jessie 決定（經 Jj／專案經理 Bot 問，唔好直接問 Jessie）。
