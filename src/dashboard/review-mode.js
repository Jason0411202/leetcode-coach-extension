import { getAllProblems, getSettings, submitRating, clearBehaviorLog } from '../lib/storage.js';
import { getTodayQueue, todayDateString } from '../lib/scheduler.js';
import '../components/review-card.js';

let queue = [];
let currentIdx = 0;
let settings = null;
let problemsCache = null;
let completed = 0;

(async function init() {
  settings = await getSettings();
  problemsCache = await getAllProblems();
  queue = getTodayQueue(problemsCache, settings.daily_review_cap);

  document.getElementById('exit-btn').addEventListener('click', () => window.close());
  document.getElementById('close-finished').addEventListener('click', () => window.close());
  document.getElementById('close-empty').addEventListener('click', () => window.close());
  document.getElementById('skip-btn').addEventListener('click', skipCurrent);
  document.getElementById('open-leetcode').addEventListener('click', openCurrentInLeetCode);

  document.body.addEventListener('card-submitted', onCardSubmitted);
  document.body.addEventListener('card-skipped', skipCurrent);
  document.body.addEventListener('card-closed', () => window.close());
  document.body.addEventListener('report-issue', onReportIssue);

  if (queue.length === 0) {
    showEmpty();
    return;
  }

  document.getElementById('total-cards').textContent = queue.length;
  showCard(currentIdx);
})();

function showCard(idx) {
  const slug = queue[idx];
  document.getElementById('current-idx').textContent = idx + 1;
  const pct = Math.round((idx / queue.length) * 100);
  document.getElementById('progress-fill').style.width = `${pct}%`;

  const slot = document.getElementById('card-slot');
  slot.innerHTML = '';
  const card = document.createElement('review-card');
  card.setAttribute('problem-slug', slug);
  card.setAttribute('context', 'review-mode');
  card.setAttribute('content-url', settings.content_repo_url);
  slot.appendChild(card);
}

async function onCardSubmitted(e) {
  const detail = e.detail;
  const today = todayDateString();
  const pattern = problemsCache[detail.slug]?.pattern || [];
  await submitRating(detail.slug, {
    date: today,
    score: detail.score,
    stage_used: detail.stage_used,
    hint_level: detail.hint_level,
    auto: detail.auto
  }, pattern);
  // refresh cache so subsequent advance gets fresh state
  problemsCache = await getAllProblems();
  completed++;
  setTimeout(advance, 350);
}

function skipCurrent() {
  clearBehaviorLog(queue[currentIdx]);
  advance();
}

function advance() {
  currentIdx++;
  if (currentIdx >= queue.length) {
    showFinished();
  } else {
    showCard(currentIdx);
  }
}

function openCurrentInLeetCode() {
  const slug = queue[currentIdx];
  if (slug) window.open(`https://leetcode.com/problems/${slug}/`, '_blank', 'noopener,noreferrer');
}

function onReportIssue(e) {
  const repo = settings.github_repo_for_issues || 'Jason0411202/leetcode-coach-content';
  const slug = e.detail.slug;
  const title = encodeURIComponent(`[Content] ${slug}: ${e.detail.reason}`);
  const body = encodeURIComponent(
    `**Slug:** ${slug}\n**Reason:** ${e.detail.reason}\n\n<!-- 描述問題 -->`
  );
  window.open(
    `https://github.com/${repo}/issues/new?title=${title}&body=${body}&labels=content`,
    '_blank',
    'noopener,noreferrer'
  );
}

function showFinished() {
  document.getElementById('rm-header').hidden = true;
  document.getElementById('rm-main').hidden = true;
  const screen = document.getElementById('finished-screen');
  screen.hidden = false;
  document.getElementById('completed-count').textContent = completed;

  const streakEl = document.getElementById('finished-streak');
  if (completed >= 5) {
    streakEl.textContent = '🔥 連續超過 5 題,持續發力!';
  } else if (completed >= 1) {
    streakEl.textContent = '✓ 一點一滴累積就是進步';
  }
}

function showEmpty() {
  document.getElementById('rm-header').hidden = true;
  document.getElementById('rm-main').hidden = true;
  document.getElementById('empty-screen').hidden = false;
}
