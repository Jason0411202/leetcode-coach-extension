import { getAllProblems, getSettings } from '../lib/storage.js';
import { getTodayQueue, todayDateString } from '../lib/scheduler.js';

(async function init() {
  const [problems, settings] = await Promise.all([getAllProblems(), getSettings()]);
  renderCTA(problems, settings);
  renderStats(problems);
  renderHeatmap(problems);
  renderPatternBars(problems);
  attachListeners();
})();

function renderCTA(problems, settings) {
  const queue = getTodayQueue(problems, settings.daily_review_cap);
  const mistakes = Object.values(problems).filter(p => p.is_mistake);
  document.getElementById('today-count').textContent = queue.length;
  document.getElementById('mistake-count').textContent = mistakes.length;

  const startBtn = document.getElementById('start-review');
  const hint = document.getElementById('cta-hint');
  if (queue.length === 0) {
    startBtn.disabled = true;
    startBtn.textContent = '▶ 今日已無題目';
    hint.hidden = false;
  } else {
    startBtn.disabled = false;
    startBtn.textContent = `▶ 開始複習(${queue.length} 題)`;
  }
}

function renderStats(problems) {
  document.getElementById('total-problems').textContent = Object.keys(problems).length;
  document.getElementById('streak').textContent = computeStreak(problems);
  document.getElementById('week-count').textContent = computeWeekCount(problems);
}

function computeStreak(problems) {
  const dates = new Set();
  for (const p of Object.values(problems)) {
    for (const r of p.ratings || []) dates.add(r.date);
  }
  let streak = 0;
  const today = new Date(todayDateString() + 'T00:00:00Z');
  for (let i = 0; ; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (dates.has(ds)) {
      streak++;
    } else if (i === 0) {
      // today empty doesn't break streak yet
      continue;
    } else {
      break;
    }
  }
  return streak;
}

function computeWeekCount(problems) {
  const today = new Date(todayDateString() + 'T00:00:00Z');
  const weekAgo = new Date(today);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 6);
  const cutoff = weekAgo.toISOString().slice(0, 10);

  let count = 0;
  for (const p of Object.values(problems)) {
    for (const r of p.ratings || []) {
      if (r.date >= cutoff) count++;
    }
  }
  return count;
}

function renderHeatmap(problems) {
  const container = document.getElementById('activity-heatmap');
  const counts = {};
  for (const p of Object.values(problems)) {
    for (const r of p.ratings || []) {
      counts[r.date] = (counts[r.date] || 0) + 1;
    }
  }

  const today = new Date(todayDateString() + 'T00:00:00Z');
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const count = counts[ds] || 0;
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.style.backgroundColor = heatColor(count);
    cell.title = `${ds}: ${count} 題`;
    container.appendChild(cell);
  }
}

function heatColor(count) {
  if (count === 0) return 'var(--lc-surface)';
  if (count < 3) return 'rgba(63, 185, 80, 0.35)';
  if (count < 6) return 'rgba(63, 185, 80, 0.6)';
  if (count < 10) return 'rgba(48, 161, 78, 0.85)';
  return 'rgb(33, 110, 57)';
}

function renderPatternBars(problems) {
  const container = document.getElementById('pattern-bars');
  const empty = document.getElementById('pattern-empty');
  container.innerHTML = '';

  const stats = {};
  for (const p of Object.values(problems)) {
    if (!p.ratings || p.ratings.length === 0) continue;
    const lastScore = p.ratings[p.ratings.length - 1].score;
    for (const pat of p.pattern || []) {
      if (!stats[pat]) stats[pat] = { sum: 0, n: 0 };
      stats[pat].sum += lastScore;
      stats[pat].n += 1;
    }
  }

  const rows = Object.entries(stats)
    .map(([name, s]) => ({ name, avg: s.sum / s.n, count: s.n }))
    .sort((a, b) => b.count - a.count);

  if (rows.length === 0) {
    empty.hidden = false;
    return;
  }

  for (const { name, avg, count } of rows) {
    const pct = Math.round((avg / 5) * 100);
    const row = document.createElement('div');
    row.className = 'pattern-row';
    row.innerHTML = `
      <span class="pattern-name">${escapeHtml(name)}</span>
      <span class="pattern-bar"><span class="pattern-fill" style="width:${pct}%"></span></span>
      <span class="pattern-pct">${pct}% · ${count}</span>
    `;
    container.appendChild(row);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function attachListeners() {
  const reviewUrl = chrome.runtime.getURL('src/dashboard/review-mode.html');
  const allUrl = chrome.runtime.getURL('src/dashboard/all-problems.html');
  const mistakesUrl = chrome.runtime.getURL('src/dashboard/mistakes.html');
  const settingsUrl = chrome.runtime.getURL('src/dashboard/settings.html');

  document.getElementById('start-review').addEventListener('click', () => {
    chrome.tabs.create({ url: reviewUrl });
  });
  document.getElementById('open-all-problems').addEventListener('click', () => {
    chrome.tabs.create({ url: allUrl });
  });
  document.getElementById('open-mistakes').addEventListener('click', () => {
    chrome.tabs.create({ url: mistakesUrl });
  });
  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.tabs.create({ url: settingsUrl });
  });
  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: settingsUrl });
  });
}
