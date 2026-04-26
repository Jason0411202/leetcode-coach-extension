/**
 * Spaced repetition scheduler — pure functions, no side effects.
 *
 * Score scale (1-5):
 *   1 = 不會     → review next day
 *   2 = 看懂     → review in 2 days
 *   3 = 半會     → review in 4 days
 *   4 = 會       → review in 8 days (grows exponentially with streak)
 *   5 = 熟練     → review in 21 days (grows exponentially with streak)
 */

export const BASE_INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 21 };
export const MAX_INTERVAL_DAYS = 180;

/**
 * Compute the next-review date for a problem given its new rating and
 * full rating history (with the new rating already appended).
 *
 * @param {{date: string, score: number, auto: boolean}} newRating
 * @param {Array<{date:string, score:number, auto:boolean}>} history
 * @returns {string} ISO date 'YYYY-MM-DD'
 */
export function nextReviewDate(newRating, history) {
  let interval = BASE_INTERVALS[newRating.score] ?? 1;

  if (newRating.score >= 4) {
    const streak = countTrailingGoodStreak(history);
    interval = BASE_INTERVALS[4] * Math.pow(2, Math.max(0, streak - 1));
    interval = Math.min(interval, MAX_INTERVAL_DAYS);
  }

  if (newRating.auto) {
    interval = Math.max(1, Math.floor(interval * 0.7));
  }

  return addDays(newRating.date, interval);
}

/** Count trailing ratings with score ≥ 4. */
export function countTrailingGoodStreak(history) {
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].score >= 4) count++;
    else break;
  }
  return count;
}

/** True iff the most recent two ratings are both ≤ 2. */
export function isMistake(history) {
  if (history.length < 2) return false;
  const recent = history.slice(-2);
  return recent.every(r => r.score <= 2);
}

/**
 * Compute today's review queue from the user's stored problems.
 * Includes due-for-review + all current mistakes, deduped, shuffled, capped.
 *
 * @param {Object} userProblems  chrome.storage `problems` object
 * @param {number} cap           daily review cap (default 20)
 * @param {string} [today]       override today (YYYY-MM-DD), defaults to UTC today
 * @returns {string[]}           ordered list of slugs
 */
export function getTodayQueue(userProblems, cap = 20, today = todayDateString()) {
  const due = Object.entries(userProblems)
    .filter(([_, p]) => p.next_review && p.next_review <= today)
    .sort((a, b) => a[1].next_review.localeCompare(b[1].next_review))
    .map(([slug]) => slug);

  const mistakes = Object.entries(userProblems)
    .filter(([_, p]) => p.is_mistake)
    .map(([slug]) => slug);

  const merged = [...new Set([...due, ...mistakes])];
  return shuffle(merged).slice(0, cap);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}
