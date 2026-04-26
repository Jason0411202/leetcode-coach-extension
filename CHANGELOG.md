# Changelog

All notable changes to LeetCode Coach Extension will be documented in this file.

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
