const { PROMPT_MAX_LENGTH } = require('../config');

module.exports = function validatePrompt(prompt) {
  if (typeof prompt !== 'string') return { ok: false, error: 'Prompt must be a string.' };
  if (prompt.length === 0) return { ok: false, error: 'Prompt is empty.' };
  if (prompt.startsWith('-')) return { ok: false, error: 'Prompt may not start with -.' };
  if (prompt.length > PROMPT_MAX_LENGTH) return { ok: false, error: 'Prompt too long.' };
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(prompt)) {
    return { ok: false, error: 'Unsupported control characters.' };
  }
  return { ok: true };
};