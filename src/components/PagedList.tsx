import { useState, type ReactNode } from 'react';

const PAGE_SIZE = 50;
export default function PagedList<T>({ items, renderItem, className = '' }: {
  items: T[]; renderItem: (item: T) => ReactNode; className?: string;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  return <>
    <div className={`list-container ${className}`}>
      {items.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE).map(renderItem)}
    </div>
    {pages > 1 && <div className="list-item__row" style={{ marginTop: 8 }}>
      <button className="btn btn--ghost btn--sm" disabled={current === 0} onClick={() => setPage(current - 1)}>Anterior</button>
      <span aria-live="polite">Página {current + 1} de {pages}</span>
      <button className="btn btn--ghost btn--sm" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Siguiente</button>
    </div>}
  </>;
}
