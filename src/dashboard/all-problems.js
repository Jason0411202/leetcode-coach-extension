import { getAllProblems } from '../lib/storage.js';
import { todayDateString } from '../lib/scheduler.js';

let problems = {};
let filtered = [];

(async function init() {
  problems = await getAllProblems();
  populatePatternFilter();
  attachListeners();
  render();
})();

function populatePatternFilter() {
  const sel = document.getElementById('filter-pattern');
  const patterns = new Set();
  for (const p of Object.values(problems)) {
    for (const pat of p.pattern || []) patterns.add(pat);
  }
  for (const pat of [...patterns].sort()) {
    const opt = document.createElement('option');
    opt.value = pat;
    opt.textContent = pat;
    sel.appendChild(opt);
  }
}

function attachListeners() {
  document.getElementById('search').addEventListener('input', render);
  document.getElementById('filter-pattern').addEventListener('change', render);
  document.getElementById('filter-status').addEventListener('change', render);
  document.getElementById('sort').addEventListener('change', render);
  document.getElementById('back-link').addEventListener('click', (e) => {
    e.preventDefault();
    history.back();
  });
}

function statusOf(p, today) {
  if (p.is_mistake) return 'mistake';
  if (!p.next_review) return 'future';
  if (p.next_review < today) return 'overdue';
  if (p.next_review === today) return 'today';
  return 'future';
}

function render() {
  const today = todayDateString();
  const search = document.getElementById('search').value.trim().toLowerCase();
  const fp = document.getElementById('filter-pattern').value;
  const fs = document.getElementById('filter-status').value;
  const sort = document.getElementById('sort').value;

  let entries = Object.entries(problems).map(([slug, p]) => ({ slug, ...p }));

  if (search) entries = entries.filter(p => p.slug.toLowerCase().includes(search));
  if (fp) entries = entries.filter(p => (p.pattern || []).includes(fp));
  if (fs) entries = entries.filter(p => statusOf(p, today) === fs);

  entries.sort((a, b) => {
    if (sort === 'next_review') return (a.next_review || '9999').localeCompare(b.next_review || '9999');
    if (sort === 'last_score') {
      const sa = a.ratings?.[a.ratings.length - 1]?.score ?? 0;
      const sb = b.ratings?.[b.ratings.length - 1]?.score ?? 0;
      return sa - sb;
    }
    if (sort === 'first_seen') return (b.first_seen || '').localeCompare(a.first_seen || '');
    if (sort === 'rating_count') return (b.ratings?.length || 0) - (a.ratings?.length || 0);
    return 0;
  });

  const tbody = document.getElementById('tbody');
  const empty = document.getElementById('empty');
  const table = document.getElementById('table');
  tbody.innerHTML = '';

  if (entries.length === 0) {
    table.style.display = 'none';
    empty.hidden = false;
    return;
  }
  table.style.display = '';
  empty.hidden = true;

  for (const p of entries) {
    const lastScore = p.ratings?.[p.ratings.length - 1]?.score ?? 0;
    const dueClass = p.next_review && p.next_review < today ? 'due-overdue'
      : p.next_review === today ? 'due-today' : 'due-future';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a class="slug-link" href="https://leetcode.com/problems/${escapeAttr(p.slug)}/" target="_blank">${escapeHtml(p.slug)}</a>${p.is_mistake ? ' ⚠️' : ''}</td>
      <td>${(p.pattern || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</td>
      <td>${lastScore ? `<span class="score-pill score-${lastScore}">${lastScore}</span>` : '-'}</td>
      <td><span class="due-pill ${dueClass}">${p.next_review || '-'}</span></td>
      <td>${p.ratings?.length || 0}</td>
      <td class="actions-row">
        <button class="btn" data-action="open-leetcode" data-slug="${escapeAttr(p.slug)}">↗ LeetCode</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('[data-action="open-leetcode"]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.open(`https://leetcode.com/problems/${btn.dataset.slug}/`, '_blank', 'noopener,noreferrer');
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
