# Contributing

歡迎貢獻!請遵循以下原則。

## 設計哲學(請先讀過再 PR)

1. **單一抽象核心**:`<review-card>` 是系統核心,leetcode 注入與卡牌複習模式共用,任何新功能應優先考慮如何擴展元件而非新增獨立 UI。
2. **不送出不寫入**:行為日誌只在使用者按「送出」時才寫入 `chrome.storage`,跳過/關閉一律不寫。
3. **Schema 版本化**:任何儲存資料結構的變動都要 bump `schema_version` 並提供 migration。
4. **優雅降級**:題目沒資料時顯示「回報缺漏」,不爆掉。
5. **不收集任何資料**:沒有後端、telemetry、analytics。任何「讓我把錯誤回報到 X」的提案都會被拒絕。

## 開發流程

```bash
# 1. Fork & clone
# 2. 建分支
git checkout -b feature/your-feature

# 3. 寫程式
#    - 純函式優先寫測試(test/*.test.mjs)
#    - UI 用 test/test-card.html 手動驗證

# 4. 跑測試
npm test
node scripts/build.mjs   # 確保 build 不會壞

# 5. Push & 開 PR
```

## 不要

- ❌ 引入 npm 框架(React、Vue、jQuery 等)— 用 vanilla JS + Web Components
- ❌ 直接修改 `chrome.storage`,用 `src/lib/storage.js` 提供的 API
- ❌ 在 `<review-card>` 內部使用 light DOM,Shadow DOM 隔離是刻意的
- ❌ 加入任何外部追蹤、analytics 或第三方 CDN script
- ❌ 把同步改為「自動雲端」— 個人資料隱私是核心承諾

## 要

- ✅ 每個 PR 對應一個 issue 或一行 PR 描述足以解釋「為什麼」
- ✅ 改純函式時加單元測試
- ✅ 如果有 visual 改動,在 PR 上貼前後對比截圖
- ✅ commit message 用 conventional 格式:`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`

## Release 流程(維護者)

```bash
# 1. 在 main 上 bump version
node -e "
  const fs = require('fs');
  const m = require('./manifest.json');
  m.version = '0.2.0';
  fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2) + '\n');
"

# 2. commit + tag
git add manifest.json
git commit -m "chore: bump version to 0.2.0"
git tag v0.2.0
git push origin main --tags

# 3. CI 會自動建立 GitHub Release 並附上 zip
```

## Bug Report

開 issue,附上:
- Chrome 版本、OS
- Extension 版本(`chrome://extensions/` 看)
- 重現步驟
- console 錯誤截圖(F12 → Console tab)
