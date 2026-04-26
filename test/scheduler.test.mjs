/**
 * Unit tests for scheduler.js — uses node:test, no external deps.
 *   node --test test/scheduler.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextReviewDate,
  countTrailingGoodStreak,
  isMistake,
  getTodayQueue,
  addDays,
  BASE_INTERVALS,
  MAX_INTERVAL_DAYS
} from '../src/lib/scheduler.js';

test('addDays - simple', () => {
  assert.equal(addDays('2026-04-26', 1), '2026-04-27');
  assert.equal(addDays('2026-04-26', 0), '2026-04-26');
  assert.equal(addDays('2026-04-30', 5), '2026-05-05');
  assert.equal(addDays('2026-12-30', 5), '2027-01-04');
});

test('nextReviewDate - score 1 (不會) → 1 day', () => {
  const r = { date: '2026-04-26', score: 1, auto: false };
  assert.equal(nextReviewDate(r, [r]), '2026-04-27');
});

test('nextReviewDate - score 3 (半會) → 4 days', () => {
  const r = { date: '2026-04-26', score: 3, auto: false };
  assert.equal(nextReviewDate(r, [r]), '2026-04-30');
});

test('nextReviewDate - score 4 first time → 8 days', () => {
  const r = { date: '2026-04-26', score: 4, auto: false };
  assert.equal(nextReviewDate(r, [r]), '2026-05-04');
});

test('nextReviewDate - score 4 streak grows exponentially', () => {
  const history = [
    { date: '2026-04-01', score: 4, auto: false },
    { date: '2026-04-09', score: 4, auto: false },
    { date: '2026-04-25', score: 4, auto: false }
  ];
  const result = nextReviewDate(history[2], history);
  assert.equal(result, addDays('2026-04-25', 32));
});

test('nextReviewDate - capped at MAX_INTERVAL_DAYS', () => {
  const history = [];
  for (let i = 0; i < 20; i++) {
    history.push({ date: `2026-${String((i % 12) + 1).padStart(2, '0')}-01`, score: 5, auto: false });
  }
  const last = history[history.length - 1];
  const result = nextReviewDate(last, history);
  assert.equal(result, addDays(last.date, MAX_INTERVAL_DAYS));
});

test('nextReviewDate - auto rating shrinks interval to 70%', () => {
  const r = { date: '2026-04-26', score: 3, auto: true };
  assert.equal(nextReviewDate(r, [r]), addDays('2026-04-26', Math.floor(BASE_INTERVALS[3] * 0.7)));
});

test('nextReviewDate - auto with score 1 minimum 1 day', () => {
  const r = { date: '2026-04-26', score: 1, auto: true };
  assert.equal(nextReviewDate(r, [r]), '2026-04-27');
});

test('countTrailingGoodStreak', () => {
  assert.equal(countTrailingGoodStreak([]), 0);
  assert.equal(countTrailingGoodStreak([{ score: 4 }]), 1);
  assert.equal(countTrailingGoodStreak([{ score: 4 }, { score: 5 }]), 2);
  assert.equal(countTrailingGoodStreak([{ score: 2 }, { score: 4 }, { score: 5 }]), 2);
  assert.equal(countTrailingGoodStreak([{ score: 5 }, { score: 3 }, { score: 4 }]), 1);
  assert.equal(countTrailingGoodStreak([{ score: 1 }, { score: 2 }]), 0);
});

test('isMistake', () => {
  assert.equal(isMistake([]), false);
  assert.equal(isMistake([{ score: 1 }]), false);
  assert.equal(isMistake([{ score: 1 }, { score: 1 }]), true);
  assert.equal(isMistake([{ score: 1 }, { score: 2 }]), true);
  assert.equal(isMistake([{ score: 5 }, { score: 1 }]), false);
  assert.equal(isMistake([{ score: 2 }, { score: 5 }]), false);
  assert.equal(isMistake([{ score: 5 }, { score: 1 }, { score: 2 }]), true);
});

test('getTodayQueue - includes due', () => {
  const problems = {
    'a': { next_review: '2026-04-26', is_mistake: false },
    'b': { next_review: '2026-04-25', is_mistake: false },
    'c': { next_review: '2026-04-30', is_mistake: false }
  };
  const queue = getTodayQueue(problems, 20, '2026-04-26');
  assert.equal(queue.length, 2);
  assert.ok(queue.includes('a'));
  assert.ok(queue.includes('b'));
  assert.ok(!queue.includes('c'));
});

test('getTodayQueue - includes mistakes even if not due', () => {
  const problems = {
    'a': { next_review: '2026-05-01', is_mistake: true },
    'b': { next_review: '2026-04-26', is_mistake: false }
  };
  const queue = getTodayQueue(problems, 20, '2026-04-26');
  assert.equal(queue.length, 2);
});

test('getTodayQueue - dedupes due+mistake', () => {
  const problems = {
    'a': { next_review: '2026-04-26', is_mistake: true }
  };
  const queue = getTodayQueue(problems, 20, '2026-04-26');
  assert.equal(queue.length, 1);
});

test('getTodayQueue - respects cap', () => {
  const problems = {};
  for (let i = 0; i < 50; i++) {
    problems[`p${i}`] = { next_review: '2026-04-26', is_mistake: false };
  }
  const queue = getTodayQueue(problems, 10, '2026-04-26');
  assert.equal(queue.length, 10);
});

test('getTodayQueue - empty', () => {
  assert.deepEqual(getTodayQueue({}, 20, '2026-04-26'), []);
});
