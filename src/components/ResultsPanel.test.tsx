import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ResultsPanel from './ResultsPanel';
import PagedList from './PagedList';
import type { AnalyzedBookmark } from '../utils/bookmarks';

const row: AnalyzedBookmark = { id: 'a', originalTitle: 'Duplicate example', originalUrl: 'https://example.com', originalPath: [], healthStatus: 'pending', duplicateOf: 'b' };
const render = (bookmarks: AnalyzedBookmark[], showNetwork = false) => renderToStaticMarkup(<ResultsPanel bookmarks={bookmarks} showNetwork={showNetwork} showValidation={showNetwork} showOrganize={false}
  selectedForMove={new Set()} selectedForReview={new Set()} onToggleReview={() => {}} onToggleMove={() => {}} onFolderChange={() => {}} />);
it('shows local duplicates without claiming that link health was checked', () => {
  const html = render([row]);
  expect(html).toContain('Duplicado exacto'); expect(html).toContain('No se verificó el estado');
  expect(html).not.toContain('¡Todo en orden!');
});
it('counts timeouts and redirects as uncertain rather than dead or healthy', () => {
  const html = render([{ ...row, duplicateOf: undefined, healthStatus: 'timeout' }, { ...row, id: 'b', duplicateOf: undefined, healthStatus: 'redirected' }], true);
  expect(html).toContain('Dudosos: 2'); expect(html).toContain('Vivos: 0'); expect(html).not.toContain('Caídos:');
});
it('does not call an empty library clean', () => {
  expect(render([], true)).not.toContain('¡Todo en orden!');
});
it('bounds rendered rows for large libraries', () => {
  const items = Array.from({ length: 1000 }, (_, i) => i);
  const html = renderToStaticMarkup(<PagedList items={items} renderItem={item => <p key={item} data-row>{item}</p>} />);
  expect((html.match(/data-row/g) ?? []).length).toBe(50);
  expect(html).toContain('Página 1 de 20');
});
