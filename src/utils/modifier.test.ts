import { describe, it, expect } from 'vitest';
import { suggestShortTitle } from './modifier';

describe('suggestShortTitle', () => {
  it('returns a placeholder for an empty title', () => {
    expect(suggestShortTitle('')).toBe('Sin título');
  });

  it('leaves a title without separators untouched (only trimmed)', () => {
    expect(suggestShortTitle('  Simple Title  ')).toBe('Simple Title');
  });

  // Documented examples from the source's own JSDoc — the leftmost
  // separator wins, instead of cascading through all of them.
  it('splits at the leftmost separator', () => {
    expect(suggestShortTitle('React Docs - Getting Started | React')).toBe('React Docs');
    expect(suggestShortTitle('Stack Overflow - Where Developers Learn')).toBe('Stack Overflow');
  });

  it('keeps the original title when the leading fragment would be too short', () => {
    expect(suggestShortTitle('AI - Home')).toBe('AI - Home');
  });
});
