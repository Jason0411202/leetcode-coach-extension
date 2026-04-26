/**
 * Auto-score: estimate a 1–5 score from the user's behavior log
 * when they didn't manually rate the problem. Conservative — prefer
 * to underestimate so spaced repetition shows the problem again sooner.
 */

/**
 * @param {{viewed_explanation: boolean, viewed_hint_level: number, viewed_solution: boolean}} log
 * @returns {1|2|3|4|5}
 */
export function autoScore(log) {
  const {
    viewed_explanation = false,
    viewed_hint_level = 0,
    viewed_solution = false
  } = log || {};

  if (viewed_solution) return 2;
  if (viewed_hint_level >= 3) return 2;
  if (viewed_hint_level === 2) return 3;
  if (viewed_hint_level === 1) return 3;
  if (viewed_explanation) return 4;
  return 5;
}

const LABELS = ['', '不會', '看懂', '半會', '會', '熟練'];

export function autoScoreLabel(log) {
  return LABELS[autoScore(log)];
}

export function scoreLabel(score) {
  return LABELS[score] ?? '';
}
