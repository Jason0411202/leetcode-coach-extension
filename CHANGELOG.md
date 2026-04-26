# Changelog

All notable changes to LeetCode Coach Extension will be documented in this file.

## [0.1.2] — 2026-04-26

### Fixed
- **Hints / Solution buttons silently unresponsive on subsequent clicks**: the previous fix attached per-button click listeners after each render, but DOM mutations during view swaps could still leave a partially-broken state. Replaced the entire listener strategy with a **single delegated click handler at the shadow root**, attached once in `connectedCallback`. Standard event-delegation pattern — all clicks bubble to the shadow root regardless of which subtree is currently rendered. Verified end-to-end on real leetcode.com via Playwright: 提示, 解答, hint prev/next, pattern toggle, all action buttons fire correctly.
- **Card jumping up and down when content swaps**: the floating panel was anchored to `bottom: 60px`, so when content height changed, the top of the card moved (header + stage buttons appeared to jump). Restructured to a **stable-size flex column**: `:host` and `.root` are flex columns; `.header / .stages / .hint-nav / .rating / .actions / .footer-meta` are `flex: 0 0 auto` (fixed); only `.content-area` is `flex: 1` with internal `overflow-y: auto`. The injection panel `.lcc-content` got `position: fixed` with `height: min(640px, calc(100vh - 120px))`. Verified: header position is **0 px of movement across 4 content transitions** (vs ~200+ px before).

### Added
- **「📚 開啟複習模式」link inside the review-card** when the card is shown on a leetcode.com problem page. One click opens the dashboard's review-mode in a new tab. Card emits `open-review-mode` event; `injector.js` sends a message to `background.js` which calls `chrome.tabs.create()` — this is required because Arc, Brave, Edge strict mode and some Chrome adblockers block `window.open(chrome-extension://...)` from a content script with `ERR_BLOCKED_BY_CLIENT`. Routing through the service worker bypasses this client-side blocking. Verified on real Chromium with the unpacked extension on real leetcode.com — new tab opens, review-mode page renders cleanly.
- **Pattern tags hidden by default** in the card header. Replaced the always-visible pattern badges with a dashed `🏷️ 顯示 pattern` toggle button that reveals them on click. Difficulty badge stays visible (it's not a spoiler). Avoids accidentally giving away the algorithm pattern before the user has thought about the problem.

## [0.1.1] — 2026-04-26

### Fixed
- **Release zip layout**: files now sit at the **zip root** (instead of being nested under an inner `leetcode-coach-extension/` folder). When users extracted v0.1.0 with Windows Explorer or macOS Finder, the OS already created a wrapper folder named after the zip, causing a double-nested structure (`leetcode-coach-extension-v0.1.0/leetcode-coach-extension/manifest.json`). Pointing Chrome's "Load unpacked" at the outer folder failed with **"資訊清單檔案遺失或無法讀取"**. v0.1.1 produces a single-level layout that "just works" with stock OS extraction tools.
- CI smoke test now simulates OS-default extraction and asserts `manifest.json` lives at the root of the extract folder, plus rejects any double-nesting regression.

### Changed
- README install instructions clarified, plus a new troubleshooting note for the manifest-missing error.

## [0.1.0] — 2026-04-26

### Added
- Initial release.
- `<review-card>` Web Component with three-stage content (explanation / hints / solution) and 5-level scoring.
- LeetCode content-script injection on `leetcode.com/problems/*`.
- Dashboard with stats, 30-day heatmap, and pattern proficiency.
- Review-mode for queued daily review.
- All-problems list, mistakes book, settings page (with import/export).
- Spaced repetition scheduler (1/2/4/8/21-day base intervals with exponential growth on streaks).
- Auto-score estimation from behavior log.
- Background service worker with daily badge update.
- Build script (zero-dep zipping, deterministic output).
- CI/CD: tests, syntax check, build smoke, release zip with SHA-256, rolling `main-snapshot` prerelease.

### Known issue (fixed in 0.1.1)
- Zip extracted to a double-nested structure on Windows / macOS default extractors.
