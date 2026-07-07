// src/components/ResultsPanel.tsx

import type { AnalyzedBookmark } from '../utils/bookmarks';
import ReviewList from './ReviewList';
import OrganizeList from './OrganizeList';

type Props = {
  bookmarks: AnalyzedBookmark[];
  showValidation: boolean;
  showOrganize: boolean;
  selectedForReview: Set<string>;
  selectedForMove: Set<string>;
  onToggleReview: (id: string) => void;
  onToggleMove: (id: string) => void;
  onFolderChange: (id: string, folder: string) => void;
};

export default function ResultsPanel({
  bookmarks,
  showValidation,
  showOrganize,
  selectedForReview,
  selectedForMove,
  onToggleReview,
  onToggleMove,
  onFolderChange,
}: Props) {
  // Mirrors the `wasChecked` guard in App.tsx: healthStatus is only
  // trustworthy if a fetch actually ran (validation and/or organize).
  const wasChecked = showValidation || showOrganize;

  const alive = bookmarks.filter(
    (b) => b.healthStatus === 'alive' || b.healthStatus === 'redirected',
  );

  const problematic = wasChecked
    ? bookmarks.filter((b) =>
        ['dead', 'timeout', 'unverified', 'blocked'].includes(b.healthStatus),
      )
    : [];

  const dubious = problematic.filter(
    (b) => b.healthStatus === 'unverified' || b.healthStatus === 'blocked',
  );

  const broken = problematic.filter(
    (b) => b.healthStatus === 'dead' || b.healthStatus === 'timeout',
  );

  const organizable = bookmarks.filter(
    (b) =>
      b.suggestedFolder &&
      !['dead', 'timeout', 'unverified', 'blocked'].includes(b.healthStatus),
  );

  const nothingToDo =
    problematic.length === 0 &&
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

      {/* All clean */}
      {nothingToDo && (
        <div className="empty-state">
          <p>✨ ¡Todo en orden!</p>
          <p>No se encontraron enlaces problemáticos. La biblioteca está limpia.</p>
        </div>
      )}

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
