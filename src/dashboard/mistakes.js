import { getAllProblems } from '../lib/storage.js';

(async function init() {
  const problems = await getAllProblems();
  const mistakes = Object.entries(problems)
    .filter(([_, p]) => p.is_mistake)
    .map(([slug, p]) => ({ slug, ...p }))
    .sort((a, b) => (a.next_review || '').localeCompare(b.next_review || ''));

  document.getElementById('count').textContent = mistakes.length > 0
    ? `共 ${mistakes.length} 題`
    : '';

  const table = document.getElementById('table');
  const empty = document.getElementById('empty');
  const tbody = document.getElementById('tbody');

  if (mistakes.length === 0) {
    table.style.display = 'none';
    empty.hidden = false;
    document.getElementById('review-mistakes').disabled = true;
    document.getElementById('review-mistakes').style.opacity = '0.5';
    return;
  }

  for (const p of mistakes) {
    const recent = (p.ratings || []).slice(-2);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a class="slug-link" href="https://leetcode.com/problems/${escapeAttr(p.slug)}/" target="_blank">${escapeHtml(p.slug)}</a></td>
      <td>${(p.pattern || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</td>
      <td>${recent.map(r => `<span class="score-pill score-${r.score}">${r.score}</span>`).join(' ')}</td>
      <td>${p.next_review || '-'}</td>
      <td><button class="btn" data-slug="${escapeAttr(p.slug)}">↗ 開啟</button></td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('[data-slug]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.open(`https://leetcode.com/problems/${btn.dataset.slug}/`, '_blank', 'noopener,noreferrer');
    });
  });

  document.getElementById('review-mistakes').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/review-mode.html') });
  });
  document.getElementById('back-link').addEventListener('click', (e) => {
    e.preventDefault();
    history.back();
  });
})();

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
