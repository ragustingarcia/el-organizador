import { describe, it, expect } from 'vitest';
import { buildChangePlan, markDuplicates } from './change-plan';
import type { AnalyzedBookmark } from './bookmarks';

const bookmark = (extra: Partial<AnalyzedBookmark> = {}): AnalyzedBookmark => ({
  id: 'a', originalTitle: 'Example - Home', originalUrl: 'https://example.com/',
  originalParentId: '2', rootId: '2', originalPath: ['Otros'], healthStatus: 'alive', ...extra,
});
describe('change plan', () => {
  it('reports exact duplicates without merging query or fragment variants', () => {
    const rows = markDuplicates([
      bookmark(), bookmark({ id: 'b', originalUrl: 'https://example.com' }),
      bookmark({ id: 'c', originalUrl: 'https://example.com/?id=1' }),
      bookmark({ id: 'd', originalUrl: 'https://example.com/#chapter' }),
    ]);
    expect(rows.map(row => row.duplicateOf)).toEqual([undefined, 'a', undefined, undefined]);
  });
  it('never plans unselected moves or disabled renaming', () => {
    expect(buildChangePlan([bookmark()], new Set(), new Set(), false, 'all')).toEqual([]);
  });
  it('keeps root folders distinct instead of moving every bookmark to the bar', () => {
    const rows = [bookmark({ suggestedFolder: 'Tema' }), bookmark({ id: 'b', rootId: 'other', suggestedFolder: 'Tema' })];
    expect(buildChangePlan(rows, new Set(), new Set(['a', 'b']), false, 'all').map(p => p.targetParentId)).toEqual(['2', 'other']);
  });
  it('gives review precedence and leaves its original title intact', () => {
    const [change] = buildChangePlan([bookmark({ suggestedFolder: 'Tema' })], new Set(['a']), new Set(['a']), true, '2');
    expect(change.folder).toBe('📥 Revisión Manual'); expect(change.title).toBe('Example - Home');
  });
  it('does not nest category folders on repeated scans', () => {
    expect(buildChangePlan([bookmark({ originalPath: ['Otros', 'Tema'], originalParentId: 'category', suggestedFolder: 'Tema' })], new Set(), new Set(['a']), false, 'all')).toEqual([]);
  });
  it('trims edited destination names and previews the actual rename', () => {
    const [change] = buildChangePlan([bookmark({ suggestedFolder: '  Tema  ' })], new Set(), new Set(['a']), true, '2');
    expect(change.folder).toBe('Tema'); expect(change.title).toBe('Example');
  });
});
