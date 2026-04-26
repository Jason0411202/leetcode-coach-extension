# LeetCode Coach — Chrome Extension

Duolingo 風格的 LeetCode 學習與複習助手。

- **在 leetcode.com 上注入浮動卡片**:三段內容(理解 / 提示 / 解答)+ 五階自評
- **間隔複習**:Spaced repetition,根據評分自動排下次複習日
- **錯題本**:連續低分自動標記
- **dashboard + 卡牌複習模式**:每天進來連續複習多題
- **不收集任何資料**:所有狀態存 `chrome.storage.local`,內容 repo 唯讀
- **Manifest V3**,vanilla JS + Web Components,無框架

## 安裝

### 方式 A:從 GitHub Releases 下載已封裝版本(最簡單)

1. 到 [Releases 頁面](../../releases) 下載最新的 `leetcode-coach-extension-v*.zip`
2. **右鍵 → 解壓縮全部**(Windows)或**雙擊**(macOS)。會自動建立一個跟檔名同名的資料夾,例如 `leetcode-coach-extension-v0.1.1/`。打開那個資料夾,你應該**直接**看到 `manifest.json`、`icons/`、`src/`(而不是再進一層才看到)
3. Chrome 開啟 `chrome://extensions/`
4. 右上角開啟「**開發人員模式**」
5. 點「**載入未封裝項目**」,選擇步驟 2 解壓出來的那個資料夾(直接包含 `manifest.json` 的那一層)

> ⚠️ **如果你看到「資訊清單檔案遺失或無法讀取」:** 表示你選錯資料夾了。再進一層看看 — 有些解壓縮工具(例如 7-Zip 預設行為)會多包一層 wrapper 資料夾。要選的是**直接包含 `manifest.json` 那一層**,而不是它的 parent。

### 方式 B:從原始碼建置

```bash
git clone https://github.com/USER/leetcode-coach-extension.git
cd leetcode-coach-extension
npm test         # 跑單元測試
npm run icons    # 生成 PNG icon
npm run build    # 產生 dist/leetcode-coach-extension/
```

然後在 `chrome://extensions/` 載入 `dist/leetcode-coach-extension/`。

## 使用方式

1. 進到 [leetcode.com](https://leetcode.com) 任一題目頁面 → 右下角 📘 浮動按鈕點開卡片
2. 看「理解題目」→ 想 → 看不出來再開「提示」→ 還是不會就看「解答」
3. 自評(可選)→ 按「✓ 送出」加入複習資料庫
4. 點 Chrome 工具列的 extension 圖示 → dashboard
5. 「▶ 開始複習」→ 進入卡牌模式連續複習多題

評分規則:

| 分數 | 含義 | 預設下次複習 |
| --- | --- | --- |
| 1 | 不會 | 1 天後 |
| 2 | 看懂 | 2 天後 |
| 3 | 半會 | 4 天後 |
| 4 | 會 | 8 天後(連續 4 分以上指數成長) |
| 5 | 熟練 | 21 天後(同上) |

## 內容來源

預設讀取 `https://raw.githubusercontent.com/Jason0411202/leetcode-coach-content/main`。內容由 [leetcode-coach-content](https://github.com/Jason0411202/leetcode-coach-content) repo 提供,可在 ⚙️ 設定中改成你 fork 的私人題庫。

## 結構

```
leetcode-coach-extension/
├── manifest.json                  # MV3
├── icons/                          # 由 scripts/generate-icons.mjs 生成
├── src/
│   ├── components/
│   │   └── review-card.js          # 系統核心 Web Component
│   ├── content/
│   │   ├── injector.js             # leetcode.com 注入
│   │   └── injector.css
│   ├── dashboard/
│   │   ├── dashboard.html/js/css   # extension popup
│   │   ├── review-mode.html/js/css # 卡牌複習頁
│   │   ├── all-problems.html/js    # 題目總覽
│   │   ├── mistakes.html/js        # 錯題本
│   │   ├── settings.html/js        # 設定頁
│   │   └── list-shared.css
│   ├── lib/
│   │   ├── scheduler.js            # 純函式排程算法
│   │   ├── auto-score.js           # 自動評分推估
│   │   ├── storage.js              # chrome.storage 封裝
│   │   └── content-fetcher.js      # 抓 repo 內容(24h 快取)
│   └── background.js               # service worker
├── scripts/
│   ├── build.mjs                   # 產生 dist/ + zip
│   └── generate-icons.mjs          # 產 PNG icon
├── test/
│   ├── scheduler.test.mjs
│   ├── auto-score.test.mjs
│   └── test-card.html              # 在瀏覽器手動測試 review-card
└── .github/workflows/
    ├── ci.yml                      # PR 跑測試
    └── release.yml                 # 產生 zip + 自動發 release
```

## 開發

```bash
# 安裝(零依賴)
git clone <repo>
cd leetcode-coach-extension

# 在瀏覽器測試 review-card(不需要 extension 環境)
# 開啟 test/test-card.html

# 產生 icons + 建 dist
node scripts/generate-icons.mjs
node scripts/build.mjs

# 載入 dist/leetcode-coach-extension/ 到 chrome://extensions
```

## 隱私

- 沒有後端,沒有 telemetry,沒有 analytics
- 唯一網路請求:從 GitHub raw 抓題目 JSON
- 所有評分、進度、錯題都存在你電腦的 `chrome.storage.local`
- 無雲端同步(這是刻意的設計)

## CI/CD

每次 push 到 `main`:

1. CI 跑 23 個單元測試
2. 驗證 `manifest.json`
3. 生成 icons → 建 dist → 打包 zip
4. 上傳 zip 為 artifact(保留 30 天)
5. **更新 `main-snapshot` rolling prerelease**(隨時可下載最新 main)

打 tag `v*.*.*`:

1. 同上 + **建立正式 GitHub Release**,自動附上 zip 與 SHA-256

## 授權

MIT。詳見 [LICENSE](LICENSE)。
