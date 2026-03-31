// src/components/ReviewList.tsx

import type { AnalyzedBookmark } from '../utils/bookmarks';

type Props = {
  bookmarks: AnalyzedBookmark[];
  selected: Set<string>;
  onToggle: (id: string) => void;
};

function statusLabel(status: string): string {
  switch (status) {
    case 'dead':       return 'Caído';
    case 'timeout':    return 'Sin respuesta';
    case 'blocked':    return 'Bloqueado';
    case 'unverified': return 'Dudoso';
    default:           return status;
  }
}

function statusBadgeClass(status: string): string {
  if (status === 'dead' || status === 'blocked') return 'badge badge--danger';
  return 'badge badge--warning';
}

export default function ReviewList({ bookmarks, selected, onToggle }: Props) {
  if (bookmarks.length === 0) return null;

  return (
    <div className="mt-16">
      <h4 className="section-title">
        Enlaces para revisión ({bookmarks.length})
      </h4>
      <div className="list-container">
        {bookmarks.map((b) => (
          <div key={b.id} className="list-item">
            <p className="list-item__title">{b.originalTitle || 'Sin título'}</p>
            <span className="list-item__url">{b.originalUrl}</span>
            <div className="list-item__row">
              <input
                type="checkbox"
                checked={selected.has(b.id)}
                onChange={() => onToggle(b.id)}
                style={{ accentColor: 'var(--danger)' }}
              />
              <span>Mover a "📥 Revisión Manual"</span>
              <span className={statusBadgeClass(b.healthStatus)}>
                {statusLabel(b.healthStatus)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
