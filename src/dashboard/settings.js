import {
  getSettings,
  saveSettings,
  exportAll,
  importAll,
  replaceAllProblems
} from '../lib/storage.js';
import { clearContentCache } from '../lib/content-fetcher.js';

const $ = id => document.getElementById(id);

(async function init() {
  const s = await getSettings();
  $('content-repo-url').value = s.content_repo_url || '';
  $('github-repo-issues').value = s.github_repo_for_issues || '';
  $('daily-cap').value = s.daily_review_cap ?? 20;
  $('auto-score').checked = !!s.auto_score_enabled;

  $('save-btn').addEventListener('click', onSave);
  $('refresh-content').addEventListener('click', onRefresh);
  $('export-btn').addEventListener('click', onExport);
  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', onImport);
  $('clear-all').addEventListener('click', onClearAll);
  $('back-link').addEventListener('click', (e) => { e.preventDefault(); history.back(); });
})();

async function onSave() {
  const next = {
    content_repo_url: $('content-repo-url').value.trim().replace(/\/$/, ''),
    github_repo_for_issues: $('github-repo-issues').value.trim(),
    daily_review_cap: Math.max(1, Math.min(100, parseInt($('daily-cap').value, 10) || 20)),
    auto_score_enabled: $('auto-score').checked
  };
  await saveSettings(next);
  toast('已儲存設定');
}

async function onRefresh() {
  await clearContentCache();
  toast('已清除快取,下次載入會重新抓');
}

async function onExport() {
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leetcode-coach-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
  toast('已匯出備份');
}

async function onImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm('匯入會覆蓋現有資料。確定要繼續?')) {
    e.target.value = '';
    return;
  }
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await importAll(data);
    toast('匯入成功,重新整理頁面以套用');
  } catch (err) {
    toast(`匯入失敗:${err.message}`, true);
  }
  e.target.value = '';
}

async function onClearAll() {
  if (!confirm('真的要清空所有複習資料?此動作不可復原。')) return;
  if (!confirm('再次確認:所有評分歷史、錯題、進度都會被刪除。')) return;
  await replaceAllProblems({});
  toast('已清空');
}

function toast(msg, isError = false) {
  const t = $('toast');
  t.textContent = msg;
  t.style.background = isError ? 'var(--lc-danger)' : 'var(--lc-success)';
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 2200);
}
