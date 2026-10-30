// src/components/ResultsPanel.tsx

import type { AnalyzedBookmark } from '../utils/bookmarks';
import PagedList from './PagedList';
import ReviewList from './ReviewList';
import OrganizeList from './OrganizeList';

type Props = {
  bookmarks: AnalyzedBookmark[];
  showValidation: boolean;
  showNetwork: boolean;
  showOrganize: boolean;
  selectedForReview: Set<string>;
  selectedForMove: Set<string>;
  onKeepDuplicate?: (ids: string[], keeper: string) => void;
  onToggleReview: (id: string) => void;
  onToggleMove: (id: string) => void;
  onFolderChange: (id: string, folder: string) => void;
};

export default function ResultsPanel({
  bookmarks,
  showValidation,
  showNetwork,
  showOrganize,
  selectedForReview,
  selectedForMove,
  onKeepDuplicate,
  onToggleReview,
  onToggleMove,
  onFolderChange,
}: Props) {
  // Mirrors the `wasChecked` guard in App.tsx: healthStatus is only
  // trustworthy if a fetch actually ran (validation and/or organize).
  const wasChecked = showNetwork;

  const byId = new Map(bookmarks.map(bookmark => [bookmark.id, bookmark]));
  const duplicateGroups = new Map<string, AnalyzedBookmark[]>();
  for (const bookmark of bookmarks) {
    if (!bookmark.duplicateOf || !byId.has(bookmark.duplicateOf)) continue;
    const group = duplicateGroups.get(bookmark.duplicateOf) ?? [byId.get(bookmark.duplicateOf)!];
    group.push(bookmark); duplicateGroups.set(bookmark.duplicateOf, group);
  }

  const alive = bookmarks.filter(
    (b) => b.healthStatus === 'alive',
  );

  const problematic = bookmarks.filter(b => !!b.duplicateOf || (wasChecked &&
    ['dead', 'timeout', 'unverified', 'blocked', 'redirected'].includes(b.healthStatus)));

  const dubious = problematic.filter(
    (b) => b.healthStatus === 'unverified' || b.healthStatus === 'blocked' || b.healthStatus === 'redirected' || b.healthStatus === 'timeout',
  );

  const broken = problematic.filter(
    (b) => b.healthStatus === 'dead',
  );

  const organizable = bookmarks.filter(
    (b) =>
      b.suggestedFolder &&
      b.healthStatus !== 'blocked',
  );

  const nothingToDo =
    bookmarks.length > 0 && wasChecked && problematic.length === 0 &&
    (!showOrganize || organizable.length === 0);

  return (
    <div className="card card--purple">
      <h3 className="card__title">📜 Revisión lista</h3>

      {/* Summary badges */}
      {showValidation && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <span className="badge badge--success">
            Vivos: {alive.length}
          </span>
          {dubious.length > 0 && (
            <span className="badge badge--warning">
              Dudosos: {dubious.length}
            </span>
          )}
          {broken.length > 0 && (
            <span className="badge badge--danger">
              Caídos: {broken.length}
            </span>
          )}
        </div>
      )}

      <p>{bookmarks.length} favoritos analizados · {bookmarks.filter(b => b.duplicateOf).length} copias duplicadas exactas. Ningún favorito se elimina.</p>
      {!wasChecked && <p>No se verificó el estado de los enlaces.</p>}
      {/* All clean */}
      {nothingToDo && (
        <div className="empty-state">
          <p>✨ ¡Todo en orden!</p>
          <p>No se encontraron enlaces problemáticos en esta consulta. Revisá también los cambios de nombre propuestos.</p>
        </div>
      )}

      {duplicateGroups.size > 0 && <>
        <h4>Duplicados exactos: elegí qué favorito conservar en su ubicación</h4>
        <PagedList items={[...duplicateGroups.entries()]} renderItem={([id, group]) => <div key={id} className="list-item">
          <p>{group[0].originalUrl} · {group.length} favoritos</p>
          <PagedList items={group} renderItem={bookmark => <div key={bookmark.id} className="list-item">
            <p>{bookmark.originalTitle} · {bookmark.originalPath.join(' > ')}</p>
            <p>{selectedForReview.has(bookmark.id) ? 'Seleccionado para revisión' : 'Se conserva'}</p>
            <button className="btn btn--ghost btn--sm" disabled={!onKeepDuplicate} onClick={() => onKeepDuplicate?.(group.map(item => item.id), bookmark.id)}>Conservar este y apartar las otras copias</button>
          </div>} />
        </div>} />
      </>}
      {/* Problematic */}
      <ReviewList
        bookmarks={problematic}
        selected={selectedForReview}
        onToggle={onToggleReview}
      />

      {/* Organization */}
      {showOrganize && (
        <OrganizeList
          bookmarks={organizable}
          selected={selectedForMove}
          onToggle={onToggleMove}
          onFolderChange={onFolderChange}
        />
      )}
    </div>
  );
}
