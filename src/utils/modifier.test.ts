import { describe, it, expect } from 'vitest';
import { suggestShortTitle } from './modifier';

describe('suggestShortTitle', () => {
  it('does not invent a new title for an empty bookmark', () => {
    expect(suggestShortTitle('')).toBe('');
  });

  it('leaves a title without separators untouched (only trimmed)', () => {
    expect(suggestShortTitle('  Simple Title  ')).toBe('Simple Title');
  });

  // Documented examples from the source's own JSDoc — the leftmost
  // separator wins, instead of cascading through all of them.
  it('preserves descriptive segments instead of truncating them', () => {
    expect(suggestShortTitle('React Docs - Getting Started | React')).toBe('React Docs - Getting Started | React');
    expect(suggestShortTitle('Stack Overflow - Where Developers Learn')).toBe('Stack Overflow - Where Developers Learn');
  });

  it('keeps the original title when the leading fragment would be too short', () => {
    expect(suggestShortTitle('AI - Home')).toBe('AI - Home');
  });
});

it('removes generic Home and Inicio suffixes only', () => {
  expect(suggestShortTitle('Example - Home')).toBe('Example');
  expect(suggestShortTitle('Example | Inicio')).toBe('Example');
  expect(suggestShortTitle('AWS | Services - S3')).toBe('AWS | Services - S3');
});
