// src/components/OrganizeList.tsx

import type { AnalyzedBookmark } from '../utils/bookmarks';

type Props = {
  bookmarks: AnalyzedBookmark[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onFolderChange: (id: string, newFolder: string) => void;
};

export default function OrganizeList({
  bookmarks,
  selected,
  onToggle,
  onFolderChange,
}: Props) {
  if (bookmarks.length === 0) return null;

  return (
    <div className="mt-20">
      <h4 className="section-title" style={{ color: 'var(--gold-text)' }}>
        Sugerencias de organización ({bookmarks.length})
      </h4>
      <div className="list-container list-container--organize">
        {bookmarks.map((b) => (
          <div key={b.id} className="list-item">
            <p className="list-item__title" style={{ color: 'var(--gold-text)' }}>
              {b.originalTitle || 'Sin título'}
            </p>
            <span className="list-item__url">{b.originalUrl}</span>
            <div className="list-item__row">
              <input
                type="checkbox"
                checked={selected.has(b.id)}
                onChange={() => onToggle(b.id)}
                style={{ accentColor: 'var(--gold)' }}
              />
              <span style={{ color: 'var(--gold-text)', whiteSpace: 'nowrap' }}>
                Destino:
              </span>
              <input
                type="text"
                className="list-item__input"
                value={b.suggestedFolder ?? ''}
                onChange={(e) => onFolderChange(b.id, e.target.value)}
                disabled={!selected.has(b.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
