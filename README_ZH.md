# 股癌自動晨報系統 🦙

自動抓取股癌 Podcast 最新一集，透過 AI 語音轉文字與大型語言模型分析，產出法人級財經晨報並寄送到你的信箱。

---

## 運作流程

```
股癌 RSS Feed
     ↓
AssemblyAI 語音轉逐字稿
     ↓
Google Gemini AI 分析整理
     ↓
Gmail 寄出 HTML 晨報
```

---

## 需要準備的東西

| 項目 | 取得方式 | 費用 |
|------|----------|------|
| AssemblyAI API Key | [assemblyai.com](https://assemblyai.com) 免費註冊 | 免費（每月 $50 額度） |
| Gemini API Key | [aistudio.google.com](https://aistudio.google.com) | 免費 |
| Google Sheet | 新建一份，工作表命名為 `log` | 免費 |
| Google Apps Script | [script.google.com](https://script.google.com) | 免費 |

---

## 設定步驟

### 第一步：填寫 CONFIG

打開 `gooaye_morning_note.gs`，在最上方填入你的資訊：

```javascript
var CONFIG = {
  ASSEMBLYAI_API_KEY: '你的 AssemblyAI Key',
  GEMINI_API_KEY:     '你的 Gemini Key',
  EMAIL_ADDRESS:      '你的 Gmail 信箱',
  SHEET_ID:           '你的 Google Sheet ID',
  RSS_URL:            '...'  // 不需要修改
};
```

> **如何找 Sheet ID？** 開啟你的 Google Sheet，複製網址中 `/d/` 和 `/edit` 之間那段文字。

### 第二步：建立 GAS 專案

1. 前往 [script.google.com](https://script.google.com)
2. 點「新增專案」
3. 把 `gooaye_morning_note.gs` 的內容全部貼上
4. 儲存（Ctrl + S）

### 第三步：測試

1. 上方下拉選單選擇 `testFullFlow` → 點「執行」
2. 第一次執行會要求 Google 授權，全部允許即可
3. 等待約 10 分鐘（AssemblyAI 轉錄需要時間）
4. 切換到 `checkAndSendReport` → 點「執行」
5. 前往信箱確認是否收到晨報

### 第四步：設定自動排程

在 GAS 左側選單點「觸發條件」，新增兩個觸發器：

| 函式 | 觸發時機 | 說明 |
|------|----------|------|
| `startTranscription` | 每週三、每週六（各設一個） | 送出轉錄任務 |
| `checkAndSendReport` | 每 5 分鐘 | 檢查轉錄是否完成並寄信 |

---

## 晨報內容結構

每封晨報包含以下四個區塊：

- **一、提及公司整理** — 依美股、台股、日股、其他市場分類
- **二、本集重點摘要** — 編號條列式摘要
- **三、重點詳細說明** — 段落式深度分析，關鍵字粗體標示
- **四、QA 聽眾問答** — 謙虛老師 Q&A 環節整理

---

## 注意事項

- AssemblyAI 免費額度約 $50，股癌一週兩集（每集約 50 分鐘）每月約消耗 $8
- Google Sheet 的 `log` 工作表會記錄每次任務狀態：`processing` → `done`
- 若轉錄失敗，狀態欄會顯示 `error: ...` 錯誤訊息

---

## 技術架構

- **執行環境：** Google Apps Script (GAS)
- **語音轉文字：** AssemblyAI Universal-2 模型（支援中文）
- **AI 分析：** Google Gemini 2.5 Flash
- **資料來源：** 股癌官方 RSS Feed（SoundOn 平台）
- **輸出格式：** HTML Email（inline CSS）
