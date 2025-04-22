/**
 * Performs a fuzzy match: checks if all characters in pattern appear in str in order.
 * @param {string} pattern
 * @param {string} str
 * @returns {boolean}
 */
export function fuzzyMatch(pattern, str) {
  const p = pattern.toLowerCase();
  const s = str.toLowerCase();
  let i = 0;
  for (let j = 0; j < s.length && i < p.length; j++) {
    if (p[i] === s[j]) {
      i++;
    }
  }
  return i === p.length;
}