/**
 * <review-card> — system core.
 * Used in BOTH the LeetCode injection panel and the dashboard review-mode.
 *
 * Attributes:
 *   problem-slug  required  e.g. "two-sum"
 *   context       required  "leetcode" | "review-mode"
 *   content-url   required  raw GitHub base URL of the content repo
 *
 * Events (bubble + composed):
 *   card-submitted   detail = { slug, score, auto, behavior_log, stage_used, hint_level }
 *   card-skipped     detail = { slug }
 *   card-closed      detail = { slug }
 *   report-issue     detail = { slug, reason }
 */

import { autoScore, autoScoreLabel, scoreLabel } from '../lib/auto-score.js';

const TEMPLATE_STYLE = `
  :host {
    --lc-primary: #5b8def;
    --lc-success: #3fb950;
    --lc-warning: #d29922;
    --lc-danger: #f85149;
    --lc-bg: #ffffff;
    --lc-surface: #f6f8fa;
    --lc-text: #1f2328;
    --lc-border: #d0d7de;
    --lc-muted: #6e7781;

    display: flex;
    flex-direction: column;
    height: 100%;
    /* When parent has a definite height (e.g. .lcc-content in injection),
       the card fills it. Otherwise the card sizes to its content. */
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Noto Sans TC", sans-serif;
    background: var(--lc-bg);
    color: var(--lc-text);
    border: 1px solid var(--lc-border);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    overflow: hidden;
  }

  .root {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  /* Sections that should keep their natural size and never compress */
  .header, .stages, .hint-nav, .rating, .actions, .footer-meta {
    flex: 0 0 auto;
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --lc-bg: #0d1117;
      --lc-surface: #161b22;
      --lc-text: #e6edf3;
      --lc-border: #30363d;
      --lc-muted: #7d8590;
    }
  }

  :host([disabled]) {
    opacity: 0.6;
    pointer-events: none;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--lc-border);
    background: var(--lc-surface);
  }
  .title {
    font-weight: 700;
    font-size: 15px;
  }
  .meta {
    display: inline-flex;
    gap: 6px;
    margin-left: 8px;
    font-size: 11px;
    color: var(--lc-muted);
    flex-wrap: wrap;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    background: rgba(91, 141, 239, 0.12);
    border-radius: 999px;
    color: var(--lc-primary);
    font-weight: 600;
  }
  .badge.diff-easy { background: rgba(63, 185, 80, 0.15); color: var(--lc-success); }
  .badge.diff-medium { background: rgba(210, 153, 34, 0.18); color: var(--lc-warning); }
  .badge.diff-hard { background: rgba(248, 81, 73, 0.15); color: var(--lc-danger); }

  .pattern-toggle {
    background: none;
    border: 1px dashed var(--lc-border);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--lc-muted);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .pattern-toggle:hover {
    border-style: solid;
    border-color: var(--lc-primary);
    color: var(--lc-primary);
  }
  .pattern-badges[hidden] { display: none; }
  .pattern-badges {
    display: inline-flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--lc-muted);
    cursor: pointer;
    font-size: 18px;
    padding: 4px 8px;
    border-radius: 6px;
  }
  .close-btn:hover { background: var(--lc-border); color: var(--lc-text); }

  .stages {
    display: flex;
    gap: 8px;
    padding: 14px 16px 0 16px;
    flex-wrap: wrap;
  }
  .stage-btn {
    flex: 1 1 0;
    min-width: 100px;
    padding: 8px 10px;
    background: var(--lc-surface);
    border: 1px solid var(--lc-border);
    border-radius: 8px;
    color: var(--lc-text);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.15s;
  }
  .stage-btn:hover { background: rgba(91, 141, 239, 0.08); border-color: var(--lc-primary); }
  .stage-btn.viewed::after {
    content: ' ✓';
    color: var(--lc-success);
  }
  .stage-btn.active {
    background: rgba(91, 141, 239, 0.15);
    border-color: var(--lc-primary);
    color: var(--lc-primary);
  }

  .content-area {
    /* The ONLY flexible section. It absorbs height changes via internal
       scrolling, so the rest of the card never moves. */
    flex: 1 1 auto;
    min-height: 200px;
    max-height: 60vh;
    overflow-y: auto;
    padding: 14px 16px;
    line-height: 1.55;
    font-size: 13px;
  }
  .content-area.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--lc-muted);
    font-size: 12px;
  }

  .hint-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--lc-surface);
    border-top: 1px solid var(--lc-border);
    border-bottom: 1px solid var(--lc-border);
    font-size: 12px;
    color: var(--lc-muted);
  }
  /* The [hidden] attribute alone is overridden by .hint-nav display:flex
     above, so we need explicit precedence to actually hide it. */
  .hint-nav[hidden] { display: none; }
  .hint-nav button {
    background: none;
    border: 1px solid var(--lc-border);
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    color: var(--lc-text);
    font-size: 12px;
  }
  .hint-nav button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .rating {
    padding: 12px 16px;
    border-top: 1px solid var(--lc-border);
    background: var(--lc-surface);
  }
  .rating-label {
    font-size: 12px;
    color: var(--lc-muted);
    margin-bottom: 8px;
  }
  .rating-buttons {
    display: flex;
    gap: 6px;
  }
  .score-btn {
    flex: 1;
    padding: 8px 4px;
    border: 1px solid var(--lc-border);
    border-radius: 8px;
    background: var(--lc-bg);
    color: var(--lc-text);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s;
    text-align: center;
  }
  .score-btn .score-num {
    font-size: 16px;
    font-weight: 700;
    display: block;
  }
  .score-btn:hover { border-color: var(--lc-primary); }
  .score-btn.selected[data-score="1"] { background: var(--lc-danger); color: white; border-color: var(--lc-danger); }
  .score-btn.selected[data-score="2"] { background: #ee7055; color: white; border-color: #ee7055; }
  .score-btn.selected[data-score="3"] { background: var(--lc-warning); color: white; border-color: var(--lc-warning); }
  .score-btn.selected[data-score="4"] { background: #6cc644; color: white; border-color: #6cc644; }
  .score-btn.selected[data-score="5"] { background: var(--lc-success); color: white; border-color: var(--lc-success); }

  .auto-hint {
    margin-top: 8px;
    font-size: 11px;
    color: var(--lc-muted);
    font-style: italic;
  }

  .actions {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--lc-border);
  }
  .btn {
    flex: 1;
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid var(--lc-border);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.15s;
  }
  .btn-primary {
    background: var(--lc-primary);
    color: white;
    border-color: var(--lc-primary);
  }
  .btn-primary:hover { filter: brightness(1.08); }
  .btn-secondary {
    background: var(--lc-bg);
    color: var(--lc-text);
  }
  .btn-secondary:hover { background: var(--lc-surface); }

  .footer-meta {
    display: flex;
    justify-content: space-between;
    padding: 8px 16px;
    font-size: 11px;
    color: var(--lc-muted);
    border-top: 1px solid var(--lc-border);
  }
  .footer-meta a {
    color: var(--lc-muted);
    text-decoration: none;
    cursor: pointer;
  }
  .footer-meta a:hover { color: var(--lc-primary); text-decoration: underline; }

  .missing {
    padding: 24px 16px;
    text-align: center;
    color: var(--lc-muted);
    font-size: 13px;
    line-height: 1.6;
  }
  .missing strong {
    display: block;
    color: var(--lc-text);
    margin-bottom: 4px;
  }
  .missing a {
    color: var(--lc-primary);
    cursor: pointer;
  }

  pre, code {
    font-family: "SF Mono", Menlo, Consolas, monospace;
  }

  .content-area :first-child { margin-top: 0; }
  .content-area :last-child { margin-bottom: 0; }
`;

class ReviewCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._state = {
      problem: null,
      currentView: null,
      currentHintIndex: 0,
      manualScore: null,
      submitted: false,
      behaviorLog: {
        started_at: new Date().toISOString(),
        viewed_explanation: false,
        viewed_hint_level: 0,
        viewed_solution: false,
        manual_score: null
      }
    };
  }

  static get observedAttributes() {
    return ['problem-slug', 'context', 'content-url'];
  }

  async connectedCallback() {
    this._renderShell();
    // Attach the delegated click listener on the shadow root BEFORE
    // anything else. It handles all clicks regardless of which subtree
    // is currently rendered (loading state, missing state, normal).
    this._attachListeners();
    await this._loadContent();
    this._renderBody();
  }

  async _loadContent() {
    const slug = this.getAttribute('problem-slug');
    const base = this.getAttribute('content-url');
    if (!slug || !base) {
      this._state.problem = null;
      return;
    }
    try {
      const url = `${base.replace(/\/$/, '')}/problems/${slug}.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      this._state.problem = data;
    } catch (e) {
      console.warn('[review-card] failed to load content:', e);
      this._state.problem = null;
    }
  }

  _renderShell() {
    this.shadowRoot.innerHTML = `<style>${TEMPLATE_STYLE}</style><div class="root"></div>`;
  }

  _renderBody() {
    const root = this.shadowRoot.querySelector('.root');
    if (!this._state.problem) {
      root.innerHTML = this._renderMissing();
      return;
    }
    const p = this._state.problem;
    const ctx = this.getAttribute('context') || 'leetcode';
    const closeLabel = ctx === 'review-mode' ? '✕ 結束' : '✕';
    const skipLabel = ctx === 'review-mode' ? '⏭ 跳過' : '⏭ 關閉';

    const patterns = p.metadata.pattern || [];
    const hasPatterns = patterns.length > 0;

    root.innerHTML = `
      <div class="header">
        <div>
          <span class="title">${escapeHtml(p.metadata.title_zh || p.metadata.title_en)}</span>
          <span class="meta">
            ${hasPatterns ? `
              <button class="pattern-toggle" data-pattern-toggle title="顯示題目用到的 pattern(可能劇透)">
                <span data-pattern-toggle-label>🏷️ 顯示 pattern</span>
              </button>
              <span class="pattern-badges" data-pattern-badges hidden>
                ${patterns.map(t => `<span class="badge">${escapeHtml(t)}</span>`).join('')}
              </span>
            ` : ''}
            <span class="badge diff-${p.metadata.difficulty}">${escapeHtml(p.metadata.difficulty)}</span>
          </span>
        </div>
        <button class="close-btn" data-action="close" title="${closeLabel}">${closeLabel}</button>
      </div>

      <div class="stages">
        <button class="stage-btn" data-stage="explanation">🔍 理解題目</button>
        <button class="stage-btn" data-stage="hints">💡 提示</button>
        <button class="stage-btn" data-stage="solution">✅ 解答</button>
      </div>

      <div class="hint-nav" data-hint-nav-bar hidden>
        <span data-hint-counter>提示 1 / 1</span>
        <span>
          <button data-hint-nav="prev">← 上一個</button>
          <button data-hint-nav="next">下一個 →</button>
        </span>
      </div>

      <div class="content-area empty" data-content-area>
        點上方按鈕展開內容
      </div>

      <div class="rating">
        <div class="rating-label">自評(可選):</div>
        <div class="rating-buttons">
          ${[1, 2, 3, 4, 5].map(n => `
            <button class="score-btn" data-score="${n}">
              <span class="score-num">${n}</span>
              <span>${scoreLabel(n)}</span>
            </button>
          `).join('')}
        </div>
        <div class="auto-hint" data-auto-hint>沒評分將自動推估為:${autoScoreLabel(this._state.behaviorLog)}(${autoScore(this._state.behaviorLog)})</div>
      </div>

      <div class="actions">
        <button class="btn btn-secondary" data-action="skip">${skipLabel}</button>
        <button class="btn btn-primary" data-action="submit">✓ 送出並更新複習</button>
      </div>

      <div class="footer-meta">
        <a data-action="open-leetcode">↗ 在 LeetCode 開啟</a>
        ${ctx === 'leetcode' ? '<a data-action="open-dashboard">📊 LeetCode Coach 主頁</a>' : ''}
        <a data-action="report">⚠️ 內容有問題?</a>
      </div>
    `;
  }

  _renderMissing() {
    return `
      <div class="header">
        <div>
          <span class="title">找不到內容</span>
        </div>
        <button class="close-btn" data-action="close">✕</button>
      </div>
      <div class="missing">
        <strong>這題還沒有教學內容</strong>
        <p>內容 repo 還沒涵蓋這題,但你仍可以用 LeetCode 自己練習。</p>
        <p><a data-action="report">📝 點此回報缺漏</a></p>
      </div>
    `;
  }

  _attachListeners() {
    // Single delegated click handler on the shadow root. This is robust
    // against re-rendering (we never re-attach per-button listeners) and
    // immune to DOM mutations inside .root. Attached exactly once in
    // connectedCallback regardless of whether content loaded successfully —
    // the missing-state UI also needs the [data-action="close"] / "report"
    // handlers to work.
    if (this._listenersAttached) return;
    this._listenersAttached = true;
    this.shadowRoot.addEventListener('click', this._onShadowClick.bind(this));
  }

  _onShadowClick(event) {
    const t = event.target;

    const stage = t.closest('[data-stage]');
    if (stage) return this._onStageClick(stage.dataset.stage);

    const hintNav = t.closest('[data-hint-nav]');
    if (hintNav) {
      const total = (this._state.problem?.hints_html || []).length;
      if (total === 0) return;
      const dir = hintNav.dataset.hintNav;
      const next = dir === 'prev'
        ? this._state.currentHintIndex - 1
        : this._state.currentHintIndex + 1;
      return this._goToHint(next);
    }

    const score = t.closest('[data-score]');
    if (score) return this._selectScore(parseInt(score.dataset.score, 10));

    if (t.closest('[data-pattern-toggle]')) return this._togglePatterns();

    const action = t.closest('[data-action]');
    if (!action) return;
    switch (action.dataset.action) {
      case 'submit': return this._submit();
      case 'skip': return this._skip();
      case 'close': return this._close();
      case 'open-leetcode': return this._openLeetCode();
      case 'open-dashboard': return this._openDashboard();
      case 'report': return this._reportIssue(
        this._state.problem ? 'user-flag' : 'content-missing'
      );
    }
  }

  _togglePatterns() {
    const root = this.shadowRoot.querySelector('.root');
    if (!root) return;
    const badges = root.querySelector('[data-pattern-badges]');
    const label = root.querySelector('[data-pattern-toggle-label]');
    if (!badges || !label) return;
    if (badges.hasAttribute('hidden')) {
      badges.removeAttribute('hidden');
      label.textContent = '🏷️ 隱藏';
    } else {
      badges.setAttribute('hidden', '');
      label.textContent = '🏷️ 顯示 pattern';
    }
  }

  _onStageClick(stage) {
    if (stage === 'explanation') {
      this._showExplanation();
    } else if (stage === 'hints') {
      this._showHints();
    } else if (stage === 'solution') {
      this._showSolution();
    }
  }

  _showExplanation() {
    this._renderContent(this._sanitize(this._state.problem.explanation_html), 'explanation');
    this._state.behaviorLog.viewed_explanation = true;
    this._updateStageStates();
    this._updateAutoHint();
  }

  _showHints() {
    const hints = this._state.problem.hints_html || [];
    if (hints.length === 0) return;

    if (this._state.behaviorLog.viewed_hint_level === 0) {
      if (!window.confirm('確定不再想想嗎?提示會逐步逼近答案。')) return;
    }

    // Decide which hint index to show:
    // - already in hint view → advance to next
    // - coming from another view → resume at the next-unseen hint (or last viewed)
    let idx;
    if (this._state.currentView === 'hint') {
      idx = Math.min(this._state.currentHintIndex + 1, hints.length - 1);
    } else {
      idx = Math.min(this._state.behaviorLog.viewed_hint_level, hints.length - 1);
    }
    this._goToHint(idx);
  }

  _goToHint(idx) {
    const hints = this._state.problem.hints_html;
    const total = hints.length;
    idx = Math.max(0, Math.min(total - 1, idx));

    this._state.currentHintIndex = idx;
    this._renderContent(this._sanitize(hints[idx]), 'hint');

    const navBar = this.shadowRoot.querySelector('[data-hint-nav-bar]');
    navBar.hidden = false;
    this.shadowRoot.querySelector('[data-hint-counter]').textContent = `提示 ${idx + 1} / ${total}`;
    this.shadowRoot.querySelector('[data-hint-nav="prev"]').disabled = (idx === 0);
    this.shadowRoot.querySelector('[data-hint-nav="next"]').disabled = (idx === total - 1);

    if (idx + 1 > this._state.behaviorLog.viewed_hint_level) {
      this._state.behaviorLog.viewed_hint_level = idx + 1;
    }
    this._updateStageStates();
    this._updateAutoHint();
  }

  _showSolution() {
    if (!this._state.behaviorLog.viewed_solution) {
      if (!window.confirm('確定要看解答嗎?')) return;
    }
    this._renderContent(this._sanitize(this._state.problem.solution_html), 'solution');
    this._state.behaviorLog.viewed_solution = true;
    this._updateStageStates();
    this._updateAutoHint();
  }

  /**
   * Update the stable content-area + show/hide hint-nav.
   * Never replaces the [data-content-area] element — only its innerHTML.
   */
  _renderContent(html, view) {
    const area = this.shadowRoot.querySelector('[data-content-area]');
    const navBar = this.shadowRoot.querySelector('[data-hint-nav-bar]');
    area.classList.remove('empty');
    area.innerHTML = html;
    navBar.hidden = (view !== 'hint');
    this._state.currentView = view;
    area.scrollTop = 0;
  }

  _updateStageStates() {
    const root = this.shadowRoot.querySelector('.root');
    const stages = root.querySelectorAll('[data-stage]');
    const view = this._state.currentView;
    stages.forEach(btn => {
      btn.classList.remove('active');
      const s = btn.dataset.stage;
      const log = this._state.behaviorLog;
      const viewed =
        (s === 'explanation' && log.viewed_explanation) ||
        (s === 'hints' && log.viewed_hint_level > 0) ||
        (s === 'solution' && log.viewed_solution);
      btn.classList.toggle('viewed', viewed);
      const active =
        (s === 'explanation' && view === 'explanation') ||
        (s === 'hints' && view === 'hint') ||
        (s === 'solution' && view === 'solution');
      if (active) btn.classList.add('active');
    });
  }

  _selectScore(score) {
    this._state.manualScore = score;
    this._state.behaviorLog.manual_score = score;
    const root = this.shadowRoot.querySelector('.root');
    root.querySelectorAll('[data-score]').forEach(btn => {
      btn.classList.toggle('selected', parseInt(btn.dataset.score, 10) === score);
    });
    const hint = root.querySelector('[data-auto-hint]');
    if (hint) hint.style.display = 'none';
  }

  _updateAutoHint() {
    const hint = this.shadowRoot.querySelector('[data-auto-hint]');
    if (hint && this._state.manualScore === null) {
      hint.style.display = '';
      hint.textContent = `沒評分將自動推估為:${autoScoreLabel(this._state.behaviorLog)}(${autoScore(this._state.behaviorLog)})`;
    }
  }

  _computeStageUsed() {
    const log = this._state.behaviorLog;
    if (log.viewed_solution) return 'solution';
    if (log.viewed_hint_level > 0) return 'hints';
    if (log.viewed_explanation) return 'explanation';
    return 'none';
  }

  _submit() {
    if (this._state.submitted) return;
    const slug = this.getAttribute('problem-slug');
    const manual = this._state.manualScore;
    const score = manual ?? autoScore(this._state.behaviorLog);
    const auto = manual === null;
    const detail = {
      slug,
      score,
      auto,
      behavior_log: { ...this._state.behaviorLog, ended_at: new Date().toISOString() },
      stage_used: this._computeStageUsed(),
      hint_level: this._state.behaviorLog.viewed_hint_level
    };
    // Mark as submitted (the JS guard in line 1 of this method prevents
    // double submission). We do NOT set the [disabled] attribute here —
    // doing so would trigger :host([disabled]) → opacity:0.6 + pointer-events:none,
    // which makes the card look broken and unresponsive in the brief window
    // before the consumer (injector.js / review-mode.js) handles the event.
    // The consumer is responsible for closing or replacing the card.
    this._state.submitted = true;
    this.dispatchEvent(new CustomEvent('card-submitted', { detail, bubbles: true, composed: true }));
  }

  _skip() {
    const slug = this.getAttribute('problem-slug');
    this.dispatchEvent(new CustomEvent('card-skipped', { detail: { slug }, bubbles: true, composed: true }));
  }

  _close() {
    const slug = this.getAttribute('problem-slug');
    this.dispatchEvent(new CustomEvent('card-closed', { detail: { slug }, bubbles: true, composed: true }));
  }

  _openLeetCode() {
    const slug = this.getAttribute('problem-slug');
    const url = this._state.problem?.metadata?.leetcode_url ||
                `https://leetcode.com/problems/${slug}/`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  _openDashboard() {
    this.dispatchEvent(new CustomEvent('open-dashboard', {
      detail: { slug: this.getAttribute('problem-slug') },
      bubbles: true,
      composed: true
    }));
  }

  _reportIssue(reason) {
    const slug = this.getAttribute('problem-slug');
    this.dispatchEvent(new CustomEvent('report-issue', {
      detail: { slug, reason },
      bubbles: true,
      composed: true
    }));
  }

  /**
   * Strip <script> tags and on* attributes from HTML before injection.
   * Inline <style> and SVG are preserved.
   */
  _sanitize(html) {
    if (typeof html !== 'string') return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('script').forEach(s => s.remove());
    div.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(attr => {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
        if (attr.name === 'href' && /^javascript:/i.test(attr.value)) el.removeAttribute('href');
        if (attr.name === 'src' && /^javascript:/i.test(attr.value)) el.removeAttribute('src');
      });
    });
    return div.innerHTML;
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

if (!customElements.get('review-card')) {
  customElements.define('review-card', ReviewCard);
}

export { ReviewCard };
