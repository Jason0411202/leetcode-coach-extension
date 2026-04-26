/**
 * Thin wrapper over chrome.storage.local.
 * All persistent user state lives here. Schema documented in PLAN §2.3.
 */
import { nextReviewDate, isMistake, todayDateString } from './scheduler.js';

export const DEFAULT_SETTINGS = {
  schema_version: 1,
  auto_score_enabled: true,
  daily_review_cap: 20,
  content_repo_url: 'https://raw.githubusercontent.com/Jason0411202/leetcode-coach-content/main',
  github_repo_for_issues: 'Jason0411202/leetcode-coach-content'
};

function localApi() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    throw new Error('chrome.storage.local is not available');
  }
  return chrome.storage.local;
}

async function getKey(key) {
  const obj = await localApi().get(key);
  return obj[key];
}

async function setKey(key, value) {
  await localApi().set({ [key]: value });
}

export async function getSettings() {
  const stored = (await getKey('settings')) || {};
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings) {
  await setKey('settings', { ...DEFAULT_SETTINGS, ...settings });
}

export async function getAllProblems() {
  return (await getKey('problems')) || {};
}

export async function getProblem(slug) {
  const all = await getAllProblems();
  return all[slug];
}

/**
 * Submit a rating for a problem; updates next_review and is_mistake.
 *
 * @param {string} slug
 * @param {{date:string, score:number, stage_used:string, hint_level:number, auto:boolean}} rating
 * @param {string[]} [pattern]  patterns from content metadata (used on first rating)
 */
export async function submitRating(slug, rating, pattern) {
  const all = await getAllProblems();
  const existing = all[slug] || {
    first_seen: rating.date,
    ratings: [],
    next_review: null,
    is_mistake: false,
    pattern: pattern || []
  };
  if ((!existing.pattern || existing.pattern.length === 0) && pattern && pattern.length) {
    existing.pattern = pattern;
  }
  existing.ratings.push(rating);
  existing.next_review = nextReviewDate(rating, existing.ratings);
  existing.is_mistake = isMistake(existing.ratings);
  all[slug] = existing;
  await setKey('problems', all);
  await clearBehaviorLog(slug);
  return existing;
}

export async function getBehaviorLog(slug) {
  const all = (await getKey('behavior_log_pending')) || {};
  return all[slug];
}

export async function saveBehaviorLog(slug, log) {
  const all = (await getKey('behavior_log_pending')) || {};
  all[slug] = log;
  await setKey('behavior_log_pending', all);
}

export async function clearBehaviorLog(slug) {
  const all = (await getKey('behavior_log_pending')) || {};
  if (slug in all) {
    delete all[slug];
    await setKey('behavior_log_pending', all);
  }
}

export async function getStatsCache() {
  return (await getKey('stats_cache')) || null;
}

export async function saveStatsCache(stats) {
  await setKey('stats_cache', { ...stats, last_computed: todayDateString() });
}

/** Replace all stored problems — used by import/export. */
export async function replaceAllProblems(problems) {
  await setKey('problems', problems);
}

/** Export full state for backup. */
export async function exportAll() {
  const settings = await getSettings();
  const problems = await getAllProblems();
  const behavior = (await getKey('behavior_log_pending')) || {};
  return {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    settings,
    problems,
    behavior_log_pending: behavior
  };
}

/** Import state (overwrites). */
export async function importAll(data) {
  if (!data || data.schema_version !== 1) {
    throw new Error('Unsupported import schema');
  }
  if (data.settings) await saveSettings(data.settings);
  if (data.problems) await replaceAllProblems(data.problems);
  if (data.behavior_log_pending) await setKey('behavior_log_pending', data.behavior_log_pending);
}
