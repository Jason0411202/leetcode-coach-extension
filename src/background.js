/**
 * Service Worker (MV3 module).
 *
 * Responsibilities:
 *   - Periodically refresh the action badge with today's review count.
 *   - Handle messages from the content script (which has no module access).
 */

import {
  getSettings,
  getAllProblems,
  submitRating,
  clearBehaviorLog
} from './lib/storage.js';
import { getTodayQueue } from './lib/scheduler.js';

const ALARM_NAME = 'lcc-daily-update';

chrome.runtime.onInstalled.addListener(async () => {
  await ensureAlarm();
  await updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarm();
  await updateBadge();
});

async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) updateBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.problems) updateBadge();
});

export async function updateBadge() {
  try {
    const problems = await getAllProblems();
    const settings = await getSettings();
    const queue = getTodayQueue(problems, settings.daily_review_cap);
    const text = queue.length > 0 ? String(queue.length) : '';
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color: '#5b8def' });
  } catch (e) {
    console.warn('[lcc] updateBadge failed', e);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg)
    .then(result => sendResponse(result))
    .catch(err => {
      console.error('[lcc] message error', err);
      sendResponse({ error: String(err?.message || err) });
    });
  return true; // keep channel open for async response
});

async function handleMessage(msg) {
  switch (msg?.type) {
    case 'get-settings':
      return await getSettings();
    case 'submit-rating':
      await submitRating(msg.slug, msg.rating, msg.pattern);
      await updateBadge();
      return { ok: true };
    case 'clear-behavior-log':
      await clearBehaviorLog(msg.slug);
      return { ok: true };
    case 'update-badge':
      await updateBadge();
      return { ok: true };
    default:
      throw new Error(`Unknown message type: ${msg?.type}`);
  }
}
