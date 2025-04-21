
const { saveDiff, listDiffs, loadDiff } = require('../services/diffStore');
test('save and read diff', () => {
  const p = saveDiff('abc');
  const list = listDiffs();
  expect(list.find(f=>f.path===p)).toBeTruthy();
  const data = loadDiff(p);
  expect(data).toBe('abc');
});
