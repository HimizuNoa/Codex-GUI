const validatePrompt = require('../services/validatePrompt');

test('rejects control chars', () => {
  const res = validatePrompt("hello\x07world");
  expect(res.ok).toBe(false);
});

test('accepts normal prompt', () => {
  const res = validatePrompt("Generate a Python script that prints Hello.");
  expect(res.ok).toBe(true);
});