/**
 * Content script injected into leetcode.com/problems/* pages.
 * Creates a floating panel that hosts <review-card>.
 *
 * Note: MV3 content scripts cannot use static `import` syntax for our
 * Web Component because the worker context differs from page context;
 * we dynamic-import via chrome.runtime.getURL() instead, and host the
 * <review-card> in the page DOM.
 *
 * Communication with chrome.storage happens through background.js
 * via chrome.runtime.sendMessage to keep this content script isolated.
 */

(function () {
  if (window.__lcCoachInjected) return;
  window.__lcCoachInjected = true;

  const slug = extractSlug(location.pathname);
  if (!slug) return;

  let currentSlug = slug;
  let panelEl = null;
  let cardEl = null;
  let toggleEl = null;
  let contentEl = null;
  let settings = null;

  init();

  // Re-extract slug on SPA navigation (LeetCode is a SPA).
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      const newSlug = extractSlug(location.pathname);
      if (newSlug && newSlug !== currentSlug) {
        currentSlug = newSlug;
        rebuildCard();
      }
    }
  }, 1000);

  async function init() {
    settings = await getSettings();
    buildPanel();
    await loadComponentScript();
    attachCardEvents();
  }

  function buildPanel() {
    panelEl = document.createElement('div');
    panelEl.id = 'leetcode-coach-panel';
    panelEl.innerHTML = `
      <button class="lcc-toggle" type="button" title="LeetCode Coach">📘</button>
      <div class="lcc-content" hidden></div>
    `;
    document.body.appendChild(panelEl);

    toggleEl = panelEl.querySelector('.lcc-toggle');
    contentEl = panelEl.querySelector('.lcc-content');

    toggleEl.addEventListener('click', () => {
      const willShow = contentEl.hidden;
      contentEl.hidden = !willShow;
      if (willShow && !cardEl) rebuildCard();
    });
  }

  function rebuildCard() {
    if (!contentEl) return;
    contentEl.innerHTML = '';
    cardEl = document.createElement('review-card');
    cardEl.setAttribute('problem-slug', currentSlug);
    cardEl.setAttribute('context', 'leetcode');
    cardEl.setAttribute('content-url', settings.content_repo_url);
    contentEl.appendChild(cardEl);
  }

  async function loadComponentScript() {
    const url = chrome.runtime.getURL('src/components/review-card.js');
    const script = document.createElement('script');
    script.type = 'module';
    script.src = url;
    document.head.appendChild(script);
    await new Promise(resolve => {
      script.addEventListener('load', resolve);
      script.addEventListener('error', resolve);
    });
  }

  function attachCardEvents() {
    panelEl.addEventListener('card-submitted', async (e) => {
      const detail = e.detail;
      const today = new Date().toISOString().slice(0, 10);
      const rating = {
        date: today,
        score: detail.score,
        stage_used: detail.stage_used,
        hint_level: detail.hint_level,
        auto: detail.auto
      };
      let pattern = [];
      try {
        const cached = await fetchProblemMeta(detail.slug);
        pattern = cached?.metadata?.pattern || [];
      } catch (_) { /* ignore */ }
      try {
        await chrome.runtime.sendMessage({
          type: 'submit-rating',
          slug: detail.slug,
          rating,
          pattern
        });
        showToast('已加入複習資料庫 ✓');
      } catch (e) {
        console.error('[lcc] submit failed', e);
        showToast('儲存失敗,請開 dashboard 確認');
      }
    });

    panelEl.addEventListener('card-skipped', async (e) => {
      contentEl.hidden = true;
      await chrome.runtime.sendMessage({ type: 'clear-behavior-log', slug: e.detail.slug });
    });

    panelEl.addEventListener('card-closed', async (e) => {
      contentEl.hidden = true;
      await chrome.runtime.sendMessage({ type: 'clear-behavior-log', slug: e.detail.slug });
    });

    panelEl.addEventListener('report-issue', (e) => {
      openReportIssue(e.detail.slug, e.detail.reason);
    });

    panelEl.addEventListener('open-review-mode', () => {
      const url = chrome.runtime.getURL('src/dashboard/review-mode.html');
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  async function fetchProblemMeta(slug) {
    const url = `${settings.content_repo_url.replace(/\/$/, '')}/problems/${slug}.json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  }

  async function getSettings() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'get-settings' });
      return res || {
        content_repo_url: 'https://raw.githubusercontent.com/Jason0411202/leetcode-coach-content/main',
        github_repo_for_issues: 'Jason0411202/leetcode-coach-content'
      };
    } catch (e) {
      return {
        content_repo_url: 'https://raw.githubusercontent.com/Jason0411202/leetcode-coach-content/main',
        github_repo_for_issues: 'Jason0411202/leetcode-coach-content'
      };
    }
  }

  function openReportIssue(slug, reason) {
    const repo = settings.github_repo_for_issues || 'Jason0411202/leetcode-coach-content';
    const title = encodeURIComponent(`[Content] ${slug}: ${reason}`);
    const body = encodeURIComponent(
      `**Slug:** ${slug}\n**Reason:** ${reason}\n\n<!-- 描述問題在哪一段、有什麼錯誤 -->\n`
    );
    const url = `https://github.com/${repo}/issues/new?title=${title}&body=${body}&labels=content`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function extractSlug(pathname) {
    const m = pathname.match(/\/problems\/([a-z0-9-]+)/);
    return m ? m[1] : null;
  }

  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'lcc-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }
})();
