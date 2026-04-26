import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoScore, autoScoreLabel, scoreLabel } from '../src/lib/auto-score.js';

test('autoScore: nothing viewed → 5 (熟練)', () => {
  assert.equal(autoScore({}), 5);
  assert.equal(autoScore({
    viewed_explanation: false,
    viewed_hint_level: 0,
    viewed_solution: false
  }), 5);
});

test('autoScore: only viewed explanation → 4', () => {
  assert.equal(autoScore({
    viewed_explanation: true,
    viewed_hint_level: 0,
    viewed_solution: false
  }), 4);
});

test('autoScore: viewed hint 1 → 3', () => {
  assert.equal(autoScore({
    viewed_explanation: true,
    viewed_hint_level: 1,
    viewed_solution: false
  }), 3);
});

test('autoScore: viewed hint 2 → 3', () => {
  assert.equal(autoScore({
    viewed_explanation: true,
    viewed_hint_level: 2,
    viewed_solution: false
  }), 3);
});

test('autoScore: viewed hint 3+ → 2', () => {
  assert.equal(autoScore({
    viewed_explanation: true,
    viewed_hint_level: 3,
    viewed_solution: false
  }), 2);
  assert.equal(autoScore({
    viewed_explanation: true,
    viewed_hint_level: 5,
    viewed_solution: false
  }), 2);
});

test('autoScore: viewed solution → 2', () => {
  assert.equal(autoScore({
    viewed_explanation: true,
    viewed_hint_level: 0,
    viewed_solution: true
  }), 2);
  assert.equal(autoScore({
    viewed_explanation: true,
    viewed_hint_level: 5,
    viewed_solution: true
  }), 2);
});

test('autoScoreLabel returns Chinese label', () => {
  assert.equal(autoScoreLabel({}), '熟練');
  assert.equal(autoScoreLabel({ viewed_solution: true }), '看懂');
});

test('scoreLabel maps 1-5 to labels', () => {
  assert.equal(scoreLabel(1), '不會');
  assert.equal(scoreLabel(2), '看懂');
  assert.equal(scoreLabel(3), '半會');
  assert.equal(scoreLabel(4), '會');
  assert.equal(scoreLabel(5), '熟練');
  assert.equal(scoreLabel(0), '');
});
