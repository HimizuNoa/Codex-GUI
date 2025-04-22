import { fuzzyMatch } from '../renderer/src/utils/searchUtils';

describe('fuzzyMatch', () => {
  it('matches exact patterns', () => {
    expect(fuzzyMatch('abc', 'abc')).toBe(true);
  });
  it('matches subsequences', () => {
    expect(fuzzyMatch('ace', 'abcde')).toBe(true);
    expect(fuzzyMatch('bd', 'abcd')).toBe(true);
  });
  it('is case-insensitive', () => {
    expect(fuzzyMatch('AbC', 'aBc')).toBe(true);
  });
  it('fails when order is wrong', () => {
    expect(fuzzyMatch('ba', 'abc')).toBe(false);
  });
  it('fails when characters missing', () => {
    expect(fuzzyMatch('az', 'abc')).toBe(false);
  });
  it('matches empty pattern', () => {
    expect(fuzzyMatch('', 'anything')).toBe(true);
  });
  it('fails on empty string when pattern not empty', () => {
    expect(fuzzyMatch('a', '')).toBe(false);
  });
});